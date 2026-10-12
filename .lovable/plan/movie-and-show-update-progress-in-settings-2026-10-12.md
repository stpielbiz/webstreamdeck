# Movie and show update progress in Settings

## What changes
While "Update all movies and shows" runs in Settings, the card shows two progress lines:

```text
Movies   [==========------]  62%   1,240 / 2,000      [Stop]
Shows    [----------------]   0%   waiting            
```

- Movies and Shows each get their own bar and percentage. Shows read "Waiting" until movies finish, then fill; finished ones read "Done 100%".
- A Stop button sits right beside the progress (remote-focusable), stopping both.
- If nothing needed updating for one kind, it shows "Done 100%" immediately.
- After stopping, the bars stay showing where it stopped until the next run.

## Technical details
- `src/lib/library-sync.tsx`: keep per-kind progress (`progress: { movie, series }` each `{done,total,status}`) in the bulk state, updated by `runBulkRefresh`.
- `src/routes/_authenticated/settings.tsx`: mark both kinds "waiting" when the update starts; render two rows using the shared Progress bar with percentage and a Stop button in the same row (`data-tv-focus`).
- TV home admin button unaffected.
