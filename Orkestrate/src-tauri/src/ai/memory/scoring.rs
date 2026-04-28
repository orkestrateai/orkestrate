use super::signals::{RuntimeSignals, MaturityTier};
use super::constants::*;

pub struct CompoundScore {
    pub base_score: f64,
    pub importance: f64,
    pub recency: f64,
    pub maturity: MaturityTier,
    pub category_weight: f64,
    pub confidence: f64,
}

impl CompoundScore {
    pub fn calculate(&self) -> f64 {
        // BM25 floor override: if BM25 > 0.95, ignore recency entirely
        if self.base_score > 0.95 {
            let score = (W_RELEVANCE * self.base_score) + (W_IMPORTANCE * self.category_weight);
            let boost = match self.maturity {
                MaturityTier::Core => TIER_BOOST_CORE,
                MaturityTier::Validated => TIER_BOOST_VALIDATED,
                MaturityTier::Draft => TIER_BOOST_DRAFT,
            };
            return (score + self.confidence * 0.1) * boost;
        }

        let normalized_importance = (self.importance.min(100.0)) / 100.0;
        let score = (W_RELEVANCE * self.base_score)
            + (W_IMPORTANCE * ((normalized_importance * self.category_weight).min(1.0)))
            + (W_RECENCY * self.recency);

        let boost = match self.maturity {
            MaturityTier::Core => TIER_BOOST_CORE,
            MaturityTier::Validated => TIER_BOOST_VALIDATED,
            MaturityTier::Draft => TIER_BOOST_DRAFT,
        };

        score * boost
    }
}

pub fn calculate_recency(last_updated_at: i64, decay_factor: f64) -> f64 {
    let now = chrono::Utc::now().timestamp_millis();
    let diff_ms = (now - last_updated_at).max(0);
    let diff_days = (diff_ms as f64) / (1000.0 * 60.0 * 60.0 * 24.0);

    if diff_days <= 0.0 {
        return 1.0;
    }

    decay_factor.powf(diff_days)
}

pub fn apply_decay(signals: &mut RuntimeSignals) {
    let now = chrono::Utc::now().timestamp_millis();
    let diff_ms = (now - signals.last_updated_at).max(0);
    let diff_days = (diff_ms as f64) / (1000.0 * 60.0 * 60.0 * 24.0);

    if diff_days > 0.0 {
        // Per-category recency decay
        let decay = signals.decay_category.decay_factor();
        signals.recency = decay.powf(diff_days);

        // ByteRover legacy importance decay
        signals.importance *= DECAY_IMPORTANCE_FACTOR.powf(diff_days);

        determine_maturity(signals);
    }
}

pub fn determine_maturity(signals: &mut RuntimeSignals) {
    match signals.maturity {
        MaturityTier::Draft => {
            if signals.importance >= PROMOTE_TO_VALIDATED {
                signals.maturity = MaturityTier::Validated;
            }
        }
        MaturityTier::Validated => {
            if signals.importance >= PROMOTE_TO_CORE {
                signals.maturity = MaturityTier::Core;
            } else if signals.importance < DEMOTE_FROM_VALIDATED {
                signals.maturity = MaturityTier::Draft;
            }
        }
        MaturityTier::Core => {
            if signals.importance < DEMOTE_FROM_CORE {
                signals.maturity = MaturityTier::Validated;
            }
        }
    }
}

pub fn add_access_bonus(signals: &mut RuntimeSignals) {
    signals.importance = (signals.importance + ACCESS_IMPORTANCE_BONUS).min(100.0);
    signals.access_count += 1;
    signals.last_accessed_at = chrono::Utc::now().timestamp_millis();
    determine_maturity(signals);
}

pub fn add_update_bonus(signals: &mut RuntimeSignals) {
    signals.importance = (signals.importance + UPDATE_IMPORTANCE_BONUS).min(100.0);
    signals.update_count += 1;
    signals.last_updated_at = chrono::Utc::now().timestamp_millis();
    signals.recency = 1.0;
    determine_maturity(signals);
}

pub fn add_confirm_bonus(signals: &mut RuntimeSignals) {
    signals.confirmation_count += 1;
    signals.confidence = (signals.confidence + 0.1).min(1.0);
    signals.importance = (signals.importance + 2.0).min(100.0);
    signals.last_updated_at = chrono::Utc::now().timestamp_millis();
    signals.recency = 1.0;
}
