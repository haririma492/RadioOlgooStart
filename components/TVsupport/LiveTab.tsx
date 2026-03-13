"use client";

import { ActionButton, Field, Panel, PlaceholderText } from "./shared";

export default function LiveTab() {
  return (
    <div>
      <Panel
        title="Live Control"
        subtitle="React shell for the old Streamlit Live tab."
      >
        <Field label="Channel" placeholder="OLGOO_LIVE" />
        <Field label="Schedule to control" placeholder="Select saved schedule" />
        <Field label="Subtitle set" placeholder="Active overlay / video-linked set" />
        <div style={{ marginBottom: "14px" }}>
          <ActionButton label="Make Active" />
          <ActionButton label="Make In-Active" />
          <ActionButton label="Refresh Live Status" />
        </div>
        <PlaceholderText
          text={
            "Next phase here will port:\n" +
            "- resolve_now_playing\n" +
            "- now playing / coming up\n" +
            "- live status metrics\n" +
            "- subtitle overlay resolution\n" +
            "- live preview player with overlay"
          }
        />
      </Panel>

      <Panel
        title="Now Playing / Coming Up"
        subtitle="This area replaces the Streamlit live status fragment."
      >
        <PlaceholderText
          text="Planned features:\n- current video\n- playlist label\n- start/end timestamps\n- countdown / progress bar\n- open media directly\n- coming up table\n- runtime diagnostics"
        />
      </Panel>
    </div>
  );
}
