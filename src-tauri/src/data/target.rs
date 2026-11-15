use super::{Bounds, Point};

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum MobType {
    Passive,
    Aggressive,
    Violet,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Default)]
pub enum TargetType {
    Mob(MobType),
    #[default]
    TargetMarker,
}

/// A target in 2D space.
#[derive(Debug, Clone, Copy, Default)]
pub struct Target {
    pub target_type: TargetType,
    pub bounds: Bounds,
}

impl Target {
    /// Get the approximated attack coordinates.
    /// `offset_y` 为相对名字框底边中心的垂直偏移（像素），用于把点击落点
    /// 下移到怪物身体（名字与身体间有空档时）或上移（点到身体下方地面时）。
    pub fn get_attack_coords(&self, offset_y: i32) -> Point {
        let point = self.bounds.get_lowest_center_point();
        let y = (point.y as i32 + offset_y).clamp(0, 600) as u32;
        Point::new(point.x, y)
    }
}
