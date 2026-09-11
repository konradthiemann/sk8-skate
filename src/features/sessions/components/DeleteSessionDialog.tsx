import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteSession, sessionKeys } from "../api";
import { formatSessionDate } from "../format";

const DELETE_ERROR_TEXT = "Löschen hat nicht funktioniert. Versuch es nochmal.";

interface DeleteSessionDialogProps {
  sessionId: string;
  sessionDate: string;
  location: string;
}

/**
 * Owns both the "Löschen" trigger and the confirmation dialog + mutation
 * (design.md Abschnitt 5) – its only mount point is `SessionDetailScreen`.
 */
export function DeleteSessionDialog({
  sessionId,
  sessionDate,
  location,
}: DeleteSessionDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      queryClient.removeQueries({ queryKey: sessionKeys.detail(sessionId) });
      navigate({ to: "/sessions" });
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      mutation.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-12" data-track="session.delete-open">
          Löschen
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) => {
          // Apple HIG (ux.md Abschnitt 7d, Referenz 1): a destructive dialog's
          // default focus goes on "Abbrechen", never on the destructive action.
          event.preventDefault();
          const container = event.currentTarget as HTMLElement;
          container.querySelector<HTMLButtonElement>("[data-delete-cancel]")?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Session löschen?</DialogTitle>
          <DialogDescription>
            {formatSessionDate(sessionDate)} in {location} wird gelöscht. Das lässt sich nicht
            zurückholen.
          </DialogDescription>
        </DialogHeader>

        {mutation.isError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {DELETE_ERROR_TEXT}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-track="session.delete-cancel"
            data-delete-cancel
            className="h-11"
            disabled={mutation.isPending}
            onClick={() => handleOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="destructive"
            data-track="session.delete"
            className="h-11"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Wird gelöscht …" : "Endgültig löschen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
