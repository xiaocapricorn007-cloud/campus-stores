# Campus Stores

Campus Stores is a Product Engineer work sample set at a fictional campus media equipment desk. Work through a club’s screening, from equipment pickup to a partial return and the next morning’s handover. Open **Candidate brief** in the app for the assignment.

---

## Submission: start here

**Short answer to “would you keep this product?”** Yes. It records the right thing: one slip per physical unit, with sensible checks at pickup. But returns are closed from memory. The desk tracks *units*, while the job is about *people and requests*: who has which unit, and whether the kit is all back. My change makes every check-in start from **the unit in hand** and keeps the record of **who has the rest** current.

### Run it

```sh
python server.py          # standard library only, then open http://localhost:8000
```

| Username | Password |
|---|---|
| `Deskstaff` | `Deskstaff123` |

The credentials are also printed on the sign-in screen. Use the button in the shift card to move from Friday pickup to the return to Saturday morning. **Restart sample shift** resets the records. Opening `index.html` directly no longer works, because sign-in needs the server.

---

## One moment the product handles well: Friday 3:45 pm pickup

Issuing the Film Society kit (RQ-214) in the original:

- **The broken projector can’t leave.** PR-06 is in the workshop, and it never appears in “Unit leaving the desk”. Only PR-04 can be picked.
- **The request limits the kit.** Choosing an item type that isn’t on RQ-214 is refused (“This equipment type is outside the approved request”). Trying to issue a second adapter is refused too (“The approved quantity of this equipment type is already on loan”).
- **One slip per physical unit.** The projector, speaker and adapter each get their own slip. That is what makes Friday evening’s partial return possible to record at all.

**I kept all of this.** Pickup was already the part of the desk that protects stock.

## One moment I’d change: Saturday 9:00 am, Leela hands over “an adapter”

In the original Loan register, the morning shift sees two outstanding slips with identical controls:

```
L-404 · AD-12    RQ-214 · Kabir Sen · Due Fri 8 pm      [Record return]
L-401 · MI-09    RQ-209 · Tara Shah · Due Sat 10 am     [Record return]
```

To close the right one, the new shift has to piece the story together from memory and three tabs:

- **The slip still says Kabir has it.** The fact that Leela has the adapter exists only in the Desk book, on a different tab. The Friday handover could only be free text, with no link to the slip.
- **Nothing says it’s late.** Fri 8 pm has passed, yet the row looks exactly like Tara’s microphone, which isn’t due yet.
- **Nothing checks which adapter it is.** AD-12 and AD-15 sit in the same bin (C4), and the row shows only “AD-12”. **Record return** closes the slip in one click. It never asks for the tag on the unit in hand, records nothing about who returned it or its condition, and can’t be undone.

So the decision that matters most in the whole shift, closing the *right* slip for the *right* unit, rests entirely on staff memory.

## The change

**Start every check-in from the unit in hand, and keep “who has it” on the slip.**

1. **Check in by tag.** Read the tag off the unit and the desk finds its slip. A wrong unit is refused with a reason:
   - “AD-15 (Anker A8312) is on the shelf in C4, not on loan. Check the label again.”
   - “MI-09 belongs to slip L-401 (Debate Union), not this one.”
2. **Read the tag at pickup too**, so the slip records the unit that actually left the desk. Without this, the return check could refuse the right adapter if the wrong one had been picked from a list.
3. **“Who has the rest?”** When a request comes back partially, the desk asks, while the borrower is still at the counter, who has the missing items, their phone number and when they’re expected. The slip then reads “Now with Leela Das · ☎ 91234 56789 · expected Sat 9 am”.
4. **Show progress per request.** Each request shows its items as Waiting, Out, Returned or Lost. The Loan register opens with Out now, Overdue and Due ≤ 2 h, and those numbers are also the filter.
5. **The Desk book writes itself.** Issues, check-ins, holder changes, reminders and lost reports post automatic entries linked to their slips. The Desk book also opens with an “Open at [time]” summary built from the register.
6. **Undo** a check-in or a lost report. Undo also removes the Desk book entries that action posted.

### The same job, using the change

**Fri 3:45 pm · pickup.** Requests → Courtyard screening → Issue equipment.
- I read the tags PR-04, SP-02 and AD-12 off the units.
- Typing PR-06 is refused (“in repair”), and typing AD-15 into the projector field is refused (“is a USB-C → HDMI adapter, not a HDMI projector”).
- “Collected by” only offers Isha (the requester) and Kabir (authorised in Isha’s Desk book message).
- The collector’s phone is required, and Return-by can’t be later than the approved Fri 8 pm.
- The Desk book logs the issue with all three slips linked.

**Fri 7:30 pm · partial return.** Loan register → Check in a unit.
- PR-04: close the slip. The desk asks *Who has the rest?*. The speaker is on the counter, so I choose **Still with Kabir Sen**.
- SP-02: close the slip. The prompt now lists only AD-12. I choose **Leela Das**, add her phone, and set expected back to **Sat 9 am**.
- The slip and the Desk book both say where the adapter is.

**Sat 9:00 am · next shift.** I sign in fresh.
- **Overdue** shows 1. The Desk book’s *Open at Sat 9:00 am* lists L-404: AD-12, with Leela Das, expected Sat 9 am, overdue 13 h. Her number is on the slip.
- Leela hands over an adapter, and I type the tag from its label.
- If it were AD-15, the desk would refuse and leave L-404 open.
- It’s AD-12, so slip L-404 opens with “Returned by” already set to Leela Das. Close it, and the Desk book records “Everything on RQ-214 (Film Society) is back.”
- If she hadn’t come, **Manage → Remind** shows her number (tap to call) and logs the chase. **Manage → Report lost** closes the slip as lost after a checklist. The unit then can’t be issued until it’s marked found in Inventory.

### What I’d keep

- One slip per physical unit.
- The pickup checks: nothing in repair, nothing outside the approved request, no second unit of the same type. I added two more: only authorised collectors, and a return-by cap.
- The Desk book as the shift’s shared channel. It now also gets the facts the register knows.
- The four tabs and the time control. The structure was right; the return flow was the problem.

### One observation at a real counter

**Watch returns made on someone else’s behalf, like Leela’s.** Does the staffer pick up the unit and read its tag *before* touching the screen? Do they close the slip without asking a colleague or opening the Desk book?

If they still search by the borrower’s name first, the tag-first flow doesn’t match how they work. To support this, every check-in refused for a wrong tag is written to the Desk book’s Activity log. Each refusal is a slip the original one-click flow would have closed for the wrong unit.

---

## Other changes (secondary to the decision above)

- **Fixes to the original:**
  - Any listed person could collect for any request.
  - Return-by could be later than the approved time, or already past.
  - The issue form listed units outside the request.
  - Some refusals failed silently.
  - Request details were inserted into the page without HTML escaping.
  - The saved shift was only partly checked when reloaded.
- **Overdue follow-up:** reminders, logged with the method and the person contacted.
- **Lost path:** report lost, then mark found.
- **Repair flag on return:** a unit returned as “Needs check” goes to repair.
- **Design:** a full-screen layout in beige and maroon only, a collapsible sidebar, and gentle motion that respects “reduce motion”. On desktop, each tab fits without page scrolling; only the Desk book feed scrolls, inside its own panel.
- **Sign-in:** `server.py` issues and verifies HS256 JWTs (8-hour expiry). Passwords are stored as salted PBKDF2 hashes, and five failed attempts in a minute pause sign-in. There is one desk account, because club members borrow equipment and never sign in. Set `CAMPUS_JWT_SECRET` to keep sessions valid across server restarts.

## Limits I know about

- **Shift records live in each browser’s storage.** Two staff on two computers don’t share one register. In a real product the records, including phone numbers, would live on the server behind the sign-in. Here the sign-in only controls who can open the desk.
- **All people, units, phone numbers and times are fictional.** There is a single sample account.
- **Desktop fit was checked in a headless browser** at 1366×768, 1440×900 and 1920×1080. Narrower windows fall back to normal page scrolling.

## Source

- `index.html`: sign-in screen, desk layout, candidate brief and bundled icons
- `app.js`: sample records, all desk interactions and the sign-in flow
- `styles.css`: the beige and maroon theme, layout and motion
- `server.py`: serves the app, plus `/api/login` and `/api/me`

Icon license notices are in [third-party/lucide-LICENSE.txt](third-party/lucide-LICENSE.txt).

## Submit your work

1. [Fork Campus Stores](https://github.com/virinchi-healthcare/campus-stores/fork) into your GitHub account. Complete the candidate brief and push your changes to your public fork. In your README, point reviewers to your work and explain the decision you made.
2. In your fork, open **Commits**, select the final commit you want reviewed, and copy the page URL. It should look like `https://github.com/YOUR-USERNAME/campus-stores/commit/COMMIT-SHA`.
3. [Submit your work through the Google Form](https://docs.google.com/forms/d/e/1FAIpQLScvzoh1R4WS-SkiwAVBQbMvniieJYSoOEfLMyVo5CyjOvYUgQ/viewform). Your **roll number**, **email ID**, and **final commit link from your public fork** are required. Enter your roll number and email ID in the form only.
