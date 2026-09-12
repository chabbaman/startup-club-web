"use client";

import { useId, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { Button, Card, Input, Label, TextArea, TextField } from "@heroui/react";
import { api } from "@/convex/_generated/api";

type Poll = FunctionReturnType<typeof api.polls.list>[number];

function errorMessage(error: unknown) {
  return error instanceof ConvexError && typeof error.data === "string"
    ? error.data : "Something went wrong. Please try again.";
}

export function PollComposer() {
  const create = useMutation(api.polls.create);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setPublished(false);
    try {
      await create({ question, options });
      setQuestion("");
      setOptions(["", ""]);
      setPublished(true);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>Create a poll</Card.Title>
        <Card.Description>
          Publish a question for everyone on the board. Results appear only after voting, including for teachers.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <form onSubmit={publish} className="flex flex-col gap-4">
          <TextField isRequired isDisabled={pending}>
            <Label>Question</Label>
            <TextArea value={question} onChange={(event) => setQuestion(event.target.value)}
              maxLength={280} rows={2} placeholder="What should we work on next?" />
          </TextField>
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-end gap-2">
                <TextField isRequired isDisabled={pending} className="flex-1">
                  <Label>Choice {index + 1}</Label>
                  <Input fullWidth value={option} maxLength={80}
                    onChange={(event) => setOptions(options.map((value, i) => i === index ? event.target.value : value))} />
                </TextField>
                {options.length > 2 && (
                  <Button type="button" variant="ghost" isDisabled={pending}
                    aria-label={`Remove choice ${index + 1}`}
                    onPress={() => setOptions(options.filter((_, i) => i !== index))}>×</Button>
                )}
              </div>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {published && <p role="status" className="text-sm text-success">Poll published. Everyone on the board can vote now.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" isDisabled={pending || options.length >= 4}
              onPress={() => setOptions([...options, ""])}>+ Add choice</Button>
            <Button type="submit" isDisabled={pending || !question.trim() || options.some((option) => !option.trim())}>
              {pending ? "Publishing…" : "Publish poll"}
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card>
  );
}

/** Outside the view tabs so new polls remain visible in either dashboard view. */
export function LivePolls({ isTeacher }: { isTeacher: boolean }) {
  const polls = useQuery(api.polls.list);
  const headingId = useId();
  const open = polls?.filter((poll) => !poll.closed) ?? [];
  if (open.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      className="fixed bottom-4 right-4 z-30 flex max-h-[calc(100dvh-7rem)] w-[calc(100%-2rem)] flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface shadow-xl sm:bottom-6 sm:right-6 sm:w-96"
    >
      <h2 id={headingId} className="sr-only">Active club polls</h2>
      {open.map((poll) => <PollCard key={poll._id} poll={poll} isTeacher={isTeacher} />)}
    </section>
  );
}

function PollCard({ poll, isTeacher }: { poll: Poll; isTeacher: boolean }) {
  const vote = useMutation(api.polls.vote);
  const close = useMutation(api.polls.close);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const id = useId();

  async function submit(action: "vote" | "close") {
    if (pending || (action === "vote" && selected === null)) return;
    setPending(true);
    setError(null);
    try {
      if (action === "vote") await vote({ pollId: poll._id, optionIndex: selected! });
      else await close({ pollId: poll._id });
      setConfirmClose(false);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="shrink-0 rounded-2xl shadow-none">
      <Card.Header>
        <h3 id={id} className="whitespace-pre-wrap break-words font-semibold">{poll.question}</h3>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {poll.results ? (
          <div aria-label="Poll results" className="flex flex-col gap-2">
            {poll.options.map((option, index) => {
              const count = poll.results!.counts[index];
              const percent = poll.results!.total ? Math.round(count / poll.results!.total * 100) : 0;
              const mine = poll.myVote === index;
              return (
                <div key={index} className={`relative overflow-hidden rounded-lg border ${mine ? "border-accent" : "border-transparent"}`}>
                  <div aria-hidden="true" className={`absolute inset-y-0 left-0 transition-[width] duration-300 motion-reduce:transition-none ${mine ? "bg-accent/20" : "bg-default"}`}
                    style={{ width: `${percent}%` }} />
                  <div className="relative flex justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 break-words">{option}{mine && <span className="ml-2 text-accent" aria-label="Your vote">✓</span>}</span>
                    <span className="shrink-0 font-semibold tabular-nums" aria-label={`${percent} percent, ${count} votes`}>{percent}%</span>
                  </div>
                </div>
              );
            })}
            <p role="status" className="text-xs text-muted">
              {poll.results.total} {poll.results.total === 1 ? "vote" : "votes"} · {poll.closed ? "Voting closed" : "You voted"}
            </p>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void submit("vote"); }} className="flex flex-col gap-3">
            <fieldset aria-labelledby={id} disabled={pending || poll.closed} className="flex flex-col gap-2">
              {poll.options.map((option, index) => (
                <label key={index} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${selected === index ? "border-accent bg-accent/5" : "border-border"} ${poll.closed ? "text-muted" : "cursor-pointer hover:border-accent"}`}>
                  <input type="radio" name={`poll-${poll._id}`} value={index} checked={selected === index}
                    onChange={() => setSelected(index)} className="shrink-0 accent-[var(--accent)]" />
                  <span className="min-w-0 break-words">{option}</span>
                </label>
              ))}
            </fieldset>
            {!poll.closed && <Button type="submit" variant="outline" fullWidth isDisabled={pending || selected === null}>{pending ? "Submitting…" : "Vote"}</Button>}
          </form>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {isTeacher && !poll.closed && (
          <div className="border-t border-border pt-3">
            {confirmClose ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="w-full text-xs text-muted">Close voting for everyone? This cannot be undone.</p>
                <Button size="sm" variant="danger" isDisabled={pending} onPress={() => void submit("close")}>Close voting</Button>
                <Button size="sm" variant="ghost" isDisabled={pending} onPress={() => setConfirmClose(false)}>Cancel</Button>
              </div>
            ) : <Button size="sm" variant="ghost" isDisabled={pending} onPress={() => setConfirmClose(true)}>End poll</Button>}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
