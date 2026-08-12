import {
  Action,
  ActionPanel,
  closeMainWindow,
  Form,
  popToRoot,
  showToast,
  Toast,
} from "@raycast/api";
import { useState } from "react";
import { apiSend } from "./shared";

// Append a quick line to today's daily note (the written part; the voice-notes
// section is left intact server-side). POST /api/jot.
export default function Jot() {
  const [loading, setLoading] = useState(false);

  async function submit(values: Form.Values) {
    const text = String(values.text ?? "").trim();
    if (!text) {
      await showToast({ style: Toast.Style.Failure, title: "Nothing to jot" });
      return;
    }
    setLoading(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Jotting…" });
    try {
      const r = await apiSend<{ stem: string }>("POST", "/api/jot", { text });
      toast.style = Toast.Style.Success;
      toast.title = `Saved to ${r.stem}`;
      await closeMainWindow();
      await popToRoot();
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Couldn't jot";
      toast.message = (e as Error).message;
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form
      isLoading={loading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Jot to Today" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="text"
        title="Note"
        placeholder="Append a line to today's note…"
        enableMarkdown
        autoFocus
      />
    </Form>
  );
}
