"use client";

import { ActionButton, Field, Panel, PlaceholderText } from "./shared";

export default function ScheduleTab() {
  return (
    <div>
      <Panel
        title="Schedule Builder"
        subtitle="React shell for the old Streamlit Schedule tab."
      >
        <Field label="Schedule title" placeholder="Type a schedule title" />
        <Field label="Activation date / time" placeholder="Toronto / New York time" />
        <div style={{ marginBottom: "14px" }}>
          <ActionButton label="Save Schedule" />
          <ActionButton label="Make Active" />
          <ActionButton label="Make In-Active" />
        </div>
        <PlaceholderText
          text={
            "Next phase here will port:\n" +
            "- save_schedule_definition\n" +
            "- set_active_schedule\n" +
            "- deactivate_channel_runtime\n" +
            "- materialize_schedule\n" +
            "- timeline preview\n" +
            "- playlist insertion\n" +
            "- single-item insertion"
          }
        />
      </Panel>

      <Panel
        title="Runtime / Timeline"
        subtitle="This area replaces the schedule timeline and runtime diagnostics."
      >
        <PlaceholderText
          text="Planned features:\n- active channel state\n- runtime rows\n- total duration\n- plotted schedule timeline\n- current / next derived from materialized rows"
        />
      </Panel>
    </div>
  );
}
