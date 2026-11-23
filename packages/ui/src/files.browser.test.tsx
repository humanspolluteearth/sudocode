import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { axeViolations } from "./axe.ts";
import { FilesPanel } from "./FilesPanel.tsx";

describe("EDX-80 the Files panel", () => {
  it("EDX-80 lists files and shows the contents of the chosen one", async () => {
    const screen = await render(
      <FilesPanel files={{ "Scores.txt": "5\n7\n" }} onChange={() => undefined} onDelete={() => undefined} />,
    );
    await screen.getByRole("button", { name: "Scores.txt" }).click();
    await expect.element(screen.getByLabelText("Contents of Scores.txt")).toHaveValue("5\n7\n");
  });
  it("EDX-80 creates a file from a valid name and refuses a bad one", async () => {
    const onChange = vi.fn();
    const screen = await render(<FilesPanel files={{}} onChange={onChange} onDelete={() => undefined} />);
    await screen.getByLabelText("New file name").fill("bad name");
    await screen.getByRole("button", { name: "Create" }).click();
    expect(onChange).not.toHaveBeenCalled();
    await expect.element(screen.getByRole("status")).toBeVisible();
    await screen.getByLabelText("New file name").fill("Scores.txt");
    await screen.getByRole("button", { name: "Create" }).click();
    expect(onChange).toHaveBeenCalledWith("Scores.txt", "");
  });
  it("EDX-80 edits and deletes the chosen file", async () => {
    const onChange = vi.fn();
    const onDelete = vi.fn();
    const screen = await render(<FilesPanel files={{ "a.txt": "x" }} onChange={onChange} onDelete={onDelete} />);
    await screen.getByRole("button", { name: "a.txt" }).click();
    await screen.getByLabelText("Contents of a.txt").fill("hello");
    expect(onChange).toHaveBeenLastCalledWith("a.txt", "hello");
    await screen.getByRole("button", { name: "Delete" }).click();
    expect(onDelete).toHaveBeenCalledWith("a.txt");
  });
  it("MISC has no accessibility violations", async () => {
    const screen = await render(
      <FilesPanel files={{ "a.txt": "x" }} onChange={() => undefined} onDelete={() => undefined} />,
    );
    await screen.getByRole("button", { name: "a.txt" }).click();
    expect(await axeViolations(screen.container)).toEqual([]);
  });
});
