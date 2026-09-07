"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

/**
 * Upgrades the old bare "Report Issue" status flip (setStatus → MAINTENANCE)
 * into a real ticket — POST /api/maintenance-tickets flips the room status
 * AND creates a MaintenanceTicket record atomically.
 */
export function ReportIssueModal({
  roomId,
  roomNumber,
  onClose,
  onDone,
}: {
  roomId: string;
  roomNumber: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post("/api/maintenance-tickets", { roomId, title, description, priority });
      toast.success("Issue reported");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not report issue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Report Issue — Room ${roomNumber}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={title.trim().length < 3} onClick={submit}>
            Report Issue
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>What&rsquo;s wrong?</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AC not cooling" />
        </div>
        <div>
          <Label>Details (optional)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </div>
      </div>
    </Modal>
  );
}
