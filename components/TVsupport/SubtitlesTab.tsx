"use client";

import { ActionButton, Field, Panel, PlaceholderText } from "./shared";

export default function SubtitlesTab() {
  return (
    <div>
      <Panel
        title="Subtitle Composer"
        subtitle="React shell for the old Streamlit Subtitles tab."
      >
        <Field label="Subtitle set name" placeholder="Name" />
        <Field label="Subtitle set ID" placeholder="subtitle_set_id" />
        <div style={{ marginBottom: "14px" }}>
          <ActionButton label="Add Line" />
          <ActionButton label="Save Subtitle Set" />
          <ActionButton label="Load Poem Demo" />
        </div>
        <PlaceholderText
          text={
            "Next phase here will port:\n" +
            "- save_subtitle_set\n" +
            "- list_saved_subtitle_sets\n" +
            "- set_active_subtitle_set\n" +
            "- get_current_subtitle\n" +
            "- compose / library / live control sections"
          }
        />
      </Panel>

      <Panel
        title="Live Subtitle Control"
        subtitle="Overlay and video-linked subtitle set activation."
      >
        <PlaceholderText
          text="Planned features:\n- activate OVERLAY subtitle set\n- activate VIDEO subtitle set\n- preview current / next subtitle line\n- one-shot vs loop behavior"
        />
      </Panel>
    </div>
  );
}
