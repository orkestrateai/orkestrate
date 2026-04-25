use std::time::Instant;

/// Timer is currently a no-op to reduce console noise.
/// The instrumentation calls are preserved so they can be re-enabled
/// by uncommenting the println! lines below.
pub struct Timer {
    #[allow(dead_code)]
    start: Instant,
    #[allow(dead_code)]
    label: String,
}

impl Timer {
    pub fn new(label: &str) -> Self {
        // println!("[ORKESTRATE-TIMER] START {} | at {:?}", label, Instant::now());
        Self {
            start: Instant::now(),
            label: label.to_string(),
        }
    }

    #[allow(dead_code)]
    pub fn elapsed_ms(&self) -> u128 {
        self.start.elapsed().as_millis()
    }

    pub fn log(&self, _extra: &str) {
        // println!(
        //     "[ORKESTRATE-TIMER] {} = {}ms | {}",
        //     self.label,
        //     self.elapsed_ms(),
        //     extra
        // );
    }
}

impl Drop for Timer {
    fn drop(&mut self) {
        // println!(
        //     "[ORKESTRATE-TIMER] END {} | total = {}ms",
        //     self.label,
        //     self.elapsed_ms()
        // );
    }
}

/// Streaming chunk timer — currently a no-op.
pub struct ChunkTimer {
    #[allow(dead_code)]
    last_chunk: Instant,
    #[allow(dead_code)]
    start: Instant,
    #[allow(dead_code)]
    chunk_count: usize,
    #[allow(dead_code)]
    total_bytes: usize,
}

impl ChunkTimer {
    pub fn new() -> Self {
        let now = Instant::now();
        Self {
            last_chunk: now,
            start: now,
            chunk_count: 0,
            total_bytes: 0,
        }
    }

    pub fn record(&mut self, _bytes: usize) {
        // let now = Instant::now();
        // let since_last = now.duration_since(self.last_chunk).as_millis();
        // let since_start = now.duration_since(self.start).as_millis();
        // self.chunk_count += 1;
        // self.total_bytes += bytes;
        // println!(
        //     "[ORKESTRATE-TIMER] stream_chunk = chunk #{} | since_last={}ms | since_start={}ms | bytes={} | total_bytes={}",
        //     self.chunk_count, since_last, since_start, bytes, self.total_bytes
        // );
        // self.last_chunk = now;
    }

    pub fn summary(&self) {
        // let total = self.start.elapsed().as_millis();
        // let avg_gap = if self.chunk_count > 1 {
        //     total as f64 / (self.chunk_count - 1) as f64
        // } else {
        //     0.0
        // };
        // println!(
        //     "[ORKESTRATE-TIMER] stream_summary = total={}ms | chunks={} | total_bytes={} | avg_gap={:.1}ms",
        //     total, self.chunk_count, self.total_bytes, avg_gap
        // );
    }
}
