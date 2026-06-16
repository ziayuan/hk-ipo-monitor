function rowToIpo(row) {
  return {
    securityCode: row.security_code,
    securityName: row.security_name,
    securityNameEn: row.security_name_en,
    status: row.status,
    applyStartAt: row.apply_start_at,
    applyEndAt: row.apply_end_at,
    resultDate: row.result_date,
    greyMarketAt: row.grey_market_at,
    listedDate: row.listed_date,
    issueLowPrice: row.issue_low_price,
    issueHighPrice: row.issue_high_price,
    lotSize: row.lot_size,
    lowestFee: row.lowest_fee,
    leverage: row.leverage,
    enableFinance: Boolean(row.enable_finance),
    prospectusUrl: row.prospectus_url,
    sponsors: JSON.parse(row.sponsors_json || "[]"),
    source: row.source,
    sourceIpoId: row.source_ipo_id,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastSnapshotAt: row.last_snapshot_at,
    officialPublicSubscriptionMultiple: null
  };
}

function rowToSnapshot(row) {
  return {
    id: row.id,
    securityCode: row.security_code,
    capturedAt: row.captured_at,
    hoursToCutoff: row.hours_to_cutoff,
    estimatedMarginMultiple: row.estimated_margin_multiple,
    source: row.source,
    rawSourcePayload: JSON.parse(row.raw_source_payload_json || "{}")
  };
}

function rowToAlert(row) {
  return {
    id: row.id,
    securityCode: row.security_code,
    alertType: row.alert_type,
    alertKey: row.alert_key,
    triggeredAt: row.triggered_at,
    message: row.message,
    status: row.status,
    deliveryChannel: row.delivery_channel,
    sentAt: row.sent_at,
    error: row.error
  };
}

function createRepository(db) {
  return {
    upsertIpo(ipo, nowIso = new Date().toISOString()) {
      const existing = db.prepare("SELECT first_seen_at FROM ipos WHERE security_code = ?").get(ipo.securityCode);
      db.prepare(`
        INSERT INTO ipos (
          security_code, security_name, security_name_en, status, apply_start_at, apply_end_at,
          result_date, grey_market_at, listed_date, issue_low_price, issue_high_price, lot_size,
          lowest_fee, leverage, enable_finance, prospectus_url, sponsors_json, source, source_ipo_id,
          first_seen_at, last_seen_at, last_snapshot_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(security_code) DO UPDATE SET
          security_name = excluded.security_name,
          security_name_en = excluded.security_name_en,
          status = excluded.status,
          apply_start_at = excluded.apply_start_at,
          apply_end_at = excluded.apply_end_at,
          result_date = excluded.result_date,
          grey_market_at = excluded.grey_market_at,
          listed_date = excluded.listed_date,
          issue_low_price = excluded.issue_low_price,
          issue_high_price = excluded.issue_high_price,
          lot_size = excluded.lot_size,
          lowest_fee = excluded.lowest_fee,
          leverage = excluded.leverage,
          enable_finance = excluded.enable_finance,
          prospectus_url = excluded.prospectus_url,
          sponsors_json = excluded.sponsors_json,
          source = excluded.source,
          source_ipo_id = excluded.source_ipo_id,
          last_seen_at = excluded.last_seen_at
      `).run(
        ipo.securityCode,
        ipo.securityName,
        ipo.securityNameEn,
        ipo.status,
        ipo.applyStartAt,
        ipo.applyEndAt,
        ipo.resultDate,
        ipo.greyMarketAt,
        ipo.listedDate,
        ipo.issueLowPrice,
        ipo.issueHighPrice,
        ipo.lotSize,
        ipo.lowestFee,
        ipo.leverage,
        ipo.enableFinance ? 1 : 0,
        ipo.prospectusUrl,
        JSON.stringify(ipo.sponsors || []),
        ipo.source,
        ipo.sourceIpoId,
        existing ? existing.first_seen_at : nowIso,
        nowIso,
        null
      );
    },

    insertRateSnapshot(snapshot) {
      db.prepare(`
        INSERT INTO rate_snapshots (
          security_code, captured_at, hours_to_cutoff, estimated_margin_multiple, source, raw_source_payload_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        snapshot.securityCode,
        snapshot.capturedAt,
        snapshot.hoursToCutoff,
        snapshot.estimatedMarginMultiple,
        snapshot.source,
        JSON.stringify(snapshot.rawSourcePayload || {})
      );
      db.prepare("UPDATE ipos SET last_snapshot_at = ? WHERE security_code = ?").run(snapshot.capturedAt, snapshot.securityCode);
    },

    listIpos() {
      return db.prepare("SELECT * FROM ipos ORDER BY apply_end_at ASC, security_code ASC").all().map(rowToIpo);
    },

    listRateSnapshots(securityCode) {
      return db.prepare("SELECT * FROM rate_snapshots WHERE security_code = ? ORDER BY captured_at ASC").all(securityCode).map(rowToSnapshot);
    },

    listAllRateSnapshots() {
      return db.prepare("SELECT * FROM rate_snapshots ORDER BY captured_at ASC").all().map(rowToSnapshot);
    },

    insertAlert(alert) {
      try {
        db.prepare(`
          INSERT INTO alerts (
            security_code, alert_type, alert_key, triggered_at, message, status, delivery_channel
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          alert.securityCode,
          alert.alertType,
          alert.alertKey,
          alert.triggeredAt,
          alert.message,
          alert.status,
          alert.deliveryChannel
        );
        return true;
      } catch (error) {
        if (String(error.message).includes("UNIQUE")) return false;
        throw error;
      }
    },

    listAlerts() {
      return db.prepare("SELECT * FROM alerts ORDER BY triggered_at DESC, id DESC").all().map(rowToAlert);
    },

    setSourceStatus(source, status, message, checkedAt = new Date().toISOString()) {
      db.prepare(`
        INSERT INTO source_status (source, status, checked_at, message)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(source) DO UPDATE SET
          status = excluded.status,
          checked_at = excluded.checked_at,
          message = excluded.message
      `).run(source, status, checkedAt, message || null);
    },

    getSourceStatus(source) {
      return db.prepare("SELECT * FROM source_status WHERE source = ?").get(source) || null;
    }
  };
}

module.exports = {
  createRepository
};
