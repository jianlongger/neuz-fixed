use std::{
    sync::mpsc::{sync_channel, Receiver},
    time::Instant,
};

//use libscreenshot::shared::Area;
use libscreenshot::{ImageBuffer, WindowCaptureProvider};
use rayon::iter::{ParallelBridge, ParallelIterator};
use slog::Logger;
use tauri::Window;

use image::GenericImageView;

use crate::{
    data::{point_selector, Bounds, ClientStats, MobType, Point, PointCloud, Target, TargetType},
    ipc::FarmingConfig,
    platform::{IGNORE_AREA_BOTTOM, IGNORE_AREA_TOP},
    utils::Timer,
};

#[derive(Debug, Clone, Copy, Default)]
pub struct Color {
    pub refs: [u8; 3],
}

impl Color {
    pub fn new(r: u8, g: u8, b: u8) -> Self {
        Self { refs: [r, g, b] }
    }
}

#[derive(Debug, Clone)]
pub struct ImageAnalyzer {
    image: Option<ImageBuffer>,
    pub window_id: u64,
    pub client_stats: ClientStats,
}

impl ImageAnalyzer {
    pub fn new(window: &Window) -> Self {
        Self {
            window_id: 0,
            image: None,
            client_stats: ClientStats::new(window.to_owned()),
        }
    }

    pub fn image_is_some(&self) -> bool {
        self.image.is_some()
    }

    pub fn capture_window(&mut self, logger: &Logger) {
        let _timer = Timer::start_new("capture_window");
        if self.window_id == 0 {
            return;
        }

        if let Some(provider) = libscreenshot::get_window_capture_provider() {
            if let Ok(image) = provider.capture_window(self.window_id) {
                self.image = Some(image);
            } else {
                slog::warn!(logger, "Failed to capture window"; "window_id" => self.window_id);
            }
        }
    }

    pub fn pixel_detection(
        &self,
        colors: Vec<Color>,
        min_x: u32,
        min_y: u32,
        mut max_x: u32,
        mut max_y: u32,
        tolerence: Option<u8>,
    ) -> Receiver<Point> {
        let (snd, recv) = sync_channel::<Point>(4096);
        let image = self.image.as_ref().unwrap();

        if max_x == 0 {
            max_x = image.width();
        }

        if max_y == 0 {
            max_y = image.height();
        }

        image
            .enumerate_rows()
            .par_bridge()
            .for_each(move |(y, row)| {
                // Skip this row if it's in an ignored area
                let image_height = image.height();
                #[allow(clippy::absurd_extreme_comparisons)] // not always 0 (macOS)
                if y <= IGNORE_AREA_TOP
                    || y > image_height
                        .checked_sub(IGNORE_AREA_BOTTOM)
                        .unwrap_or(image_height)
                    || y > IGNORE_AREA_TOP + max_y
                    || y > max_y
                    || y < min_y
                {
                    return;
                }

                // Loop over columns
                'outer: for (x, _, px) in row {
                    if px.0[3] != 255 || x >= max_x {
                        return;
                    } else if x < min_x {
                        continue;
                    }

                    for ref_color in colors.iter() {
                        // Check if the pixel matches any of the reference colors
                        if Self::pixel_matches(&px.0, &ref_color.refs, tolerence.unwrap_or(5)) {
                            // #[allow(dropping_copy_types)]
                            // drop(snd.try_send(Point::new(x, y)));
                            // drop(snd.send(Point::new(x, y)));
                            #[allow(dropping_copy_types)]
                            drop(snd.try_send(Point::new(x, y)).map_err(|err| {
                                eprintln!("Error sending data: {}", err);
                            }));

                            // Continue to next column
                            continue 'outer;
                        }
                    }
                }
            });
        recv
    }

    fn merge_cloud_into_mobs(
        config: Option<&FarmingConfig>,
        cloud: &PointCloud,
        mob_type: TargetType, //ignore_size: bool,
    ) -> Vec<Target> {
        let _timer = Timer::start_new("merge_cloud_into_mobs");

        // Max merge distance
        let max_distance_x: u32 = 50;
        let max_distance_y: u32 = 3;

        // Cluster coordinates in x-direction
        let x_clusters = cloud.cluster_by_distance(max_distance_x, point_selector::x_axis);

        let mut xy_clusters = Vec::default();
        for x_cluster in x_clusters {
            // Cluster current x-cluster coordinates in y-direction
            let local_y_clusters =
                x_cluster.cluster_by_distance(max_distance_y, point_selector::y_axis);
            // Extend final xy-clusters with local y-clusters
            xy_clusters.extend(local_y_clusters.into_iter());
        }

        // Create mobs from clusters
        xy_clusters
            .into_iter()
            .map(|cluster| Target {
                target_type: mob_type,
                bounds: cluster.to_bounds(),
            })
            .filter(|mob| {
                if let Some(config) = config {
                    // Filter out small clusters (likely to cause misclicks)
                    mob.bounds.w > config.min_mobs_name_width() &&
                        // Filter out huge clusters (likely to be Violet Magician Troupe)
                        mob.bounds.w < config.max_mobs_name_width()
                } else {
                    true
                }
            })
            .collect()
    }

    /// Check if pixel `c` matches reference pixel `r` with the given `tolerance`.
    #[inline(always)]
    fn pixel_matches(c: &[u8; 4], r: &[u8; 3], tolerance: u8) -> bool {
        let matches_inner = |a: u8, b: u8| match (a, b) {
            (a, b) if a == b => true,
            (a, b) if a > b => a.saturating_sub(b) <= tolerance,
            (a, b) if a < b => b.saturating_sub(a) <= tolerance,
            _ => false,
        };
        let perm = [(c[0], r[0]), (c[1], r[1]), (c[2], r[2])];
        perm.iter().all(|&(a, b)| matches_inner(a, b))
    }

    /// Same as `pixel_matches` but against a list of reference colors.
    #[inline(always)]
    fn pixel_matches_any(c: &[u8; 4], colors: &[[u8; 3]], tolerance: u8) -> bool {
        for r in colors {
            if Self::pixel_matches(c, r, tolerance) {
                return true;
            }
        }
        false
    }

    /// Whether a red or green health bar is rendered within `margin` px around
    /// the given bounds (above or below the name). Used as a shape-confirmation
    /// filter so UI elements sharing the monster name color are not misread.
    fn has_health_bar_near(&self, bounds: &Bounds, margin: u32) -> bool {
        let image = self.image.as_ref().unwrap();
        let (w, h) = (image.width(), image.height());
        let x0 = bounds.x.saturating_sub(margin).min(w.saturating_sub(1));
        let x1 = (bounds.x + bounds.w + margin).min(w.saturating_sub(1));
        let y0 = bounds.y.saturating_sub(margin).min(h.saturating_sub(1));
        let y1 = (bounds.y + bounds.h + margin).min(h.saturating_sub(1));
        for y in y0..=y1 {
            for x in x0..=x1 {
                if Self::is_health_bar_color(&image.get_pixel(x, y).0) {
                    return true;
                }
            }
        }
        false
    }

    /// A red or green health-bar pixel: one channel clearly dominant over the
    /// others (e.g. full-HP red, low-HP dark red, or a green bar).
    #[inline(always)]
    fn is_health_bar_color(px: &[u8; 4]) -> bool {
        let (r, g, b) = (px[0] as i16, px[1] as i16, px[2] as i16);
        let red = r > 110 && g < r - 35 && b < r - 35;
        let green = g > 110 && r < g - 35 && b < g - 35;
        red || green
    }

    pub fn identify_mobs(&self, config: &FarmingConfig) -> Vec<Target> {
        let _timer = Timer::start_new("identify_mobs");

        // Create collections for passive and aggro mobs
        let mut mob_coords_pas: Vec<Point> = Vec::default();
        let mut mob_coords_agg: Vec<Point> = Vec::default();
        let mut mob_coords_violet: Vec<Point> = Vec::default();

        // Reference colors (now a list per category for multi-color support)
        let pas_colors: Vec<[u8; 3]> = config.passive_mobs_colors_list();
        let agg_colors: Vec<[u8; 3]> = config.aggressive_mobs_colors_list();
        let violet_colors: Vec<[u8; 3]> = {
            let v = config.violet_mobs_colors();
            vec![[
                v[0].unwrap_or(182),
                v[1].unwrap_or(144),
                v[2].unwrap_or(146),
            ]]
        };

        // Collect pixel clouds
        struct MobPixel(u32, u32, TargetType);
        // The channel must be bounded to stay `Sync` (required by rayon), but a
        // blocking `send` would deadlock here: the consumer below only starts
        // after this parallel loop has finished, so once the buffer is full the
        // producers wait forever for a consumer that isn't running yet.
        //
        // `try_send` never blocks. Sizing the buffer to the total pixel count
        // means it can never actually fill up (there cannot be more matching
        // pixels than pixels), so nothing is dropped either. This mirrors how
        // `pixel_detection` above already avoids the same deadlock.
        let image = self.image.as_ref().unwrap();
        let img_w = image.width();
        let img_h = image.height();

        // T1: restrict the scanned area to the play viewport using the
        // user-configured margins (0 = no restriction on that side). This skips
        // UI bands (skill bar, chat, minimap, teammate bars) so we process fewer
        // pixels -> faster detection and fewer false positives.
        let min_scan_x = config.scan_margin_left();
        let max_scan_x = img_w.saturating_sub(config.scan_margin_right());
        let min_scan_y = IGNORE_AREA_TOP.saturating_add(config.scan_margin_top());
        let max_scan_y = img_h
            .saturating_sub(IGNORE_AREA_BOTTOM)
            .saturating_sub(config.scan_margin_bottom());

        let capacity = img_w as usize * img_h as usize;
        let (snd, recv) = sync_channel::<MobPixel>(capacity);
        image
            .enumerate_rows()
            .par_bridge()
            .for_each(move |(y, row)| {
                // Skip rows outside the configured scan region
                if y <= min_scan_y || y > max_scan_y {
                    return;
                }
                for (x, _, px) in row {
                    if px.0[3] != 255 {
                        return;
                    } else if x <= 250 && y <= 110 {
                        // avoid detect the health bar as a monster
                        continue;
                    } else if x < min_scan_x || x > max_scan_x {
                        // outside the horizontal scan region (UI bands)
                        continue;
                    }
                    let mut matched: Option<TargetType> = None;
                    if Self::pixel_matches_any(&px.0, &pas_colors, config.passive_tolerence()) {
                        matched = Some(TargetType::Mob(MobType::Passive));
                    } else if Self::pixel_matches_any(
                        &px.0,
                        &agg_colors,
                        config.aggressive_tolerence(),
                    ) {
                        matched = Some(TargetType::Mob(MobType::Aggressive));
                    } else if Self::pixel_matches_any(
                        &px.0,
                        &violet_colors,
                        config.violet_tolerence(),
                    ) {
                        matched = Some(TargetType::Mob(MobType::Violet));
                    }
                    if let Some(mt) = matched {
                        drop(snd.try_send(MobPixel(x, y, mt)));
                    }
                }
            });
        while let Ok(px) = recv.recv() {
            match px.2 {
                TargetType::Mob(MobType::Passive) => mob_coords_pas.push(Point::new(px.0, px.1)),
                TargetType::Mob(MobType::Aggressive) => mob_coords_agg.push(Point::new(px.0, px.1)),
                TargetType::Mob(MobType::Violet) => mob_coords_violet.push(Point::new(px.0, px.1)),
                _ => unreachable!(),
            }
        }

        // Categorize mobs
        let mut mobs_pas = Self::merge_cloud_into_mobs(
            Some(config),
            &PointCloud::new(mob_coords_pas),
            TargetType::Mob(MobType::Passive),
        );
        let mut mobs_agg = Self::merge_cloud_into_mobs(
            Some(config),
            &PointCloud::new(mob_coords_agg),
            TargetType::Mob(MobType::Aggressive),
        );
        let _mobs_violet = Self::merge_cloud_into_mobs(
            Some(config),
            &PointCloud::new(mob_coords_violet),
            TargetType::Mob(MobType::Violet),
        );

        // T2: optional shape confirmation — only keep mobs that have a health
        // bar (red or green) rendered near the name, rejecting UI elements that
        // happen to share the monster name color.
        if config.require_health_bar() {
            let margin = config.health_bar_margin();
            mobs_pas.retain(|m| self.has_health_bar_near(&m.bounds, margin));
            mobs_agg.retain(|m| self.has_health_bar_near(&m.bounds, margin));
        }

        // Return all mobs
        Vec::from_iter(mobs_agg.into_iter().chain(mobs_pas))
    }

    pub fn identify_target_marker(&self, blue_target: bool) -> Option<Target> {
        let _timer = Timer::start_new("identify_target_marker");
        let mut coords = Vec::default();

        // Reference color
        let ref_color: Color = {
            if blue_target {
                // Color::new(164, 180, 226) //A4B4E1 -- blueish
                Color::new(131, 148, 205) //A4B4E1 -- blueish - more center of the arrow
            } else {
                Color::new(246, 90, 106) //F65A6A -- redish
            }
            //changed the Original colors (below), because they don't work in Azria
            // if !blank_target {
            //     Color::new(246, 90, 106) //F65A6A
            // } else {
            //     Color::new(164, 180, 226) //A4B4E1
            // }
        };

        // Collect pixel clouds
        let recv = self.pixel_detection(vec![ref_color], 0, 0, 0, 0, None);

        // // Receive points from channel
        while let Ok(point) = recv.recv() {
            coords.push(point);
        }

        // // Receive points from channel
        // loop {
        //     match recv.recv() {
        //         Ok(point) => {
        //             coords.push(point);
        //         }
        //         Err(std::sync::mpsc::RecvError) => {
        //             eprintln!("Error receiving data, channel is closed");
        //             // Channel is closed, break the loop
        //             break;
        //         }
        //         Err(err) => {
        //             eprintln!("Error receiving data: {}", err);
        //             // Handle other errors if needed
        //         }
        //     }
        // }

        // Identify target marker entities
        let target_markers =
            Self::merge_cloud_into_mobs(None, &PointCloud::new(coords), TargetType::TargetMarker);

        if !blue_target && target_markers.is_empty() {
            return self.identify_target_marker(true);
        }

        // Find biggest target marker
        target_markers.into_iter().max_by_key(|x| x.bounds.size())
    }
    pub fn get_target_marker_distance(&self, target: Target) -> i32 {
        let image = self.image.as_ref().unwrap();

        // Calculate middle point of player
        let mid_x = (image.width() / 2) as i32;
        let mid_y = (image.height() / 2) as i32;

        // Calculate 2D euclidian distances to player
        let point = target.bounds.get_lowest_center_point();

        (((mid_x - (point.x as i32)).pow(2) + (mid_y - (point.y as i32)).pow(2)) as f64).sqrt()
            as i32
    }
    /// Distance: `[0..=500]`
    pub fn find_closest_mob<'a>(
        &self,
        mobs: &'a [Target],
        //avoid_bounds: Option<&Bounds>,
        avoid_list: Option<&Vec<(Bounds, Instant, u128)>>,
        max_distance: i32,
        _logger: &Logger,
    ) -> Option<&'a Target> {
        let _timer = Timer::start_new("find_closest_mob");

        let image = self.image.as_ref().unwrap();

        // Calculate middle point of player
        let mid_x = (image.width() / 2) as i32;
        let mid_y = (image.height() / 2) as i32;

        // Calculate 2D euclidian distances to player
        let mut distances = Vec::default();
        for mob in mobs {
            let point = mob.get_attack_coords();
            let distance = (((mid_x - (point.x as i32)).pow(2) + (mid_y - (point.y as i32)).pow(2))
                as f64)
                .sqrt() as i32;
            distances.push((mob, distance));
        }

        // Sort by distance
        distances.sort_by_key(|&(_, distance)| distance);

        // Remove mobs that are too far away
        distances = distances
            .into_iter()
            .filter(|&(_, distance)| distance <= max_distance)
            .collect();

        if let Some(avoided_bounds) = avoid_list {
            // Try finding closest mob that's not the mob to be avoided
            if let Some((mob, _distance)) = distances.iter().find(|(mob, _distance)| {
                //*distance > 55
                let coords = mob.get_attack_coords();
                let mut result = true;
                for avoided_item in avoided_bounds {
                    if avoided_item.0.contains_point(&coords) {
                        //slog::debug!(logger, ""; "Avoided bounds" => avoided_item.0);
                        result = false;
                        break;
                    }
                }
                result // && *distance > 20
                       // let coords = mob.name_bounds.get_lowest_center_point();
                       // !avoid_bounds.grow_by(100).contains_point(&coords) && *distance > 200
            }) {
                Some(mob)
            } else {
                None
            }
        } else {
            // Return closest mob
            if let Some((mob, _distance)) = distances.first() {
                Some(*mob)
            } else {
                None
            }
        }
    }
}

/// Returns the actually-scanned rectangle (x, y, w, h) in captured-image pixel
/// coordinates for the given image size and farming config. This is exactly the
/// region the detector iterates over, so it is the rectangle that should be
/// outlined on the game window / screenshot to show the user what is scanned.
pub fn scan_region_rect(
    img_w: u32,
    img_h: u32,
    cfg: &FarmingConfig,
) -> (u32, u32, u32, u32) {
    let x0 = cfg.scan_margin_left();
    let x1 = img_w.saturating_sub(cfg.scan_margin_right());
    let y0 = IGNORE_AREA_TOP.saturating_add(cfg.scan_margin_top());
    let y1 = img_h
        .saturating_sub(IGNORE_AREA_BOTTOM)
        .saturating_sub(cfg.scan_margin_bottom());
    let x = x0;
    let y = y0;
    let w = x1.saturating_sub(x0);
    let h = y1.saturating_sub(y0);
    (x, y, w.max(1), h.max(1))
}
