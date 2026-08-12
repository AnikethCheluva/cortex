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

// Create a task on the wiki board. POST /api/tasks commits wiki/tasks/<slug>.md.
export default function AddTask() {
  const [loading, setLoading] = useState(false);

  async function submit(values: Form.Values) {
    const title = String(values.title ?? "").trim();
    if (!title) {
      await showToast({ style: Toast.Style.Failure, title: "Title required" });
      return;
    }
    setLoading(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Adding task…" });
    try {
      const due = values.due as Date | null | undefined;
      await apiSend("POST", "/api/tasks", {
        title,
        project: String(values.project ?? "").trim() || undefined,
        priority: values.priority || "medium",
        due_date: due ? due.toISOString().slice(0, 10) : "",
      });
      toast.style = Toast.Style.Success;
      toast.title = "Task added";
      await closeMainWindow();
      await popToRoot();
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Couldn't add task";
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
          <Action.SubmitForm title="Add Task" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="title" title="Title" placeholder="What needs doing?" autoFocus />
      <Form.TextField
        id="project"
        title="Project"
        placeholder="example-project, research, personal… (optional)"
      />
      <Form.Dropdown id="priority" title="Priority" defaultValue="medium">
        <Form.Dropdown.Item value="high" title="High" />
        <Form.Dropdown.Item value="medium" title="Medium" />
        <Form.Dropdown.Item value="low" title="Low" />
      </Form.Dropdown>
      <Form.DatePicker id="due" title="Due" type={Form.DatePicker.Type.Date} />
    </Form>
  );
}
