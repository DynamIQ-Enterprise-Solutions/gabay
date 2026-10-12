# Your spike venues

Export each venue from the gabay_spike app (Venues → the venue → Share), save the `.json` here, and run `npm run seed` again from `db/seeds`. Each file becomes a venue in "Spike Venues" with the next free beacon Major (3, 4, …), in file-name order (a file that sorts earlier moves the Majors of the files after it; the seed prints each venue's Major).

- The `.json` files here are **git-ignored** (like `../internal/`): they are never committed, and `worktree:new` does not copy them into a coder's working copy. This README is the only tracked file in the folder.
- A file the seed cannot use (not JSON, not a spike venue, a name over 200 characters, the same code as an earlier file, duplicate beacon Minors, or beacons that are not Spike Venues') is **skipped with one line** naming the file and the reason. Everything else is seeded; fix or remove the file and run the seed again.
