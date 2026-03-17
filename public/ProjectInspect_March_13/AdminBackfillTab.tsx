"use client";

import { ActionButton, Panel, PlaceholderText } from "./shared";

export default function AdminBackfillTab() {
  return (
    <div>
      <Panel
        title="Admin / Data Maintenance"
        subtitle="React shell for the old Streamlit Admin / Backfill tab."
      >
        <div style={{ marginBottom: "14px" }}>
          <ActionButton label="Describe Table" />
          <ActionButton label="Scan Sample" />
          <ActionButton label="Preview Enrichment" />
          <ActionButton label="Run Backfill" />
        </div>
        <PlaceholderText
          text={
            "Next phase here will port:\n" +
            "- describe_table\n" +
            "- scan_sample\n" +
            "- infer_enrichment\n" +
            "- diff_missing_fields\n" +
            "- apply_updates\n" +
            "- dry-run / apply flow"
          }
        />
      </Panel>

      <Panel
        title="Operational Tables"
        subtitle="This will replace the builder sidebar actions for ensuring Dynamo tables exist."
      >
        <PlaceholderText
          text="Planned features:\n- ensure RadioOlgooPlaylists\n- ensure RadioOlgooSchedules\n- ensure RadioOlgooChannelState\n- ensure RadioOlgooSubtitles\n- diagnostics and table structure checks"
        />
      </Panel>
    </div>
  );
}
