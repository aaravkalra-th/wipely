# Voiceover clips

Drop MP3s here, named by cue id. Whichever exist will play; missing ones are
skipped silently, so a partial set works fine.

| File | Line | Cue (s) | Gap before next |
| --- | --- | --- | --- |
| `l1.mp3` | "You bring more home than you realize." | 0.9 | **installed — 2.78 s** |
| `l2.mp3` | "Washing your hands removes what you picked up outside." | 3.85 | **installed — 3.86 s** |
| `l3.mp3` | "Clean hands. Problem solved?" | 9.5 | 1.8 s |
| `l4.mp3` | "Then you touch your phone." | 11.3 | 2.7 s |
| `l5.mp3` | "And put it all back." | 14.0 | 2.0 s |
| `l6.mp3` | "Meet Wipely." | 16.0 | 2.6 s |
| `l7.mp3` | "A flat pad of wipes that sticks to the back of your phone…" | 18.6 | 3.2 s |
| `step1.mp3` | "Peel a sheet from the pad on your phone." | 21.75 | 0.42 s |
| `step2.mp3` | "Wipe the screen and the back." | 22.17 | 0.42 s |
| `step3.mp3` | "Start fresh without changing your routine." | 22.59 | — |

**Keep each clip inside its gap.** The three steps are only 0.42 s apart, which
is far too tight for spoken lines — those almost certainly need the timeline
stretched. Once the files are in, `voiceover.durations()` reports the real
lengths and the cue times can be refitted to them rather than guessed.

Format: mono MP3, 128 kbps is plenty for speech. Trim leading silence — the cue
fires at the exact frame the line appears, so any padding reads as a delay.
