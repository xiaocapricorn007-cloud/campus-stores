(() => {
  const storageKey = "campus-stores.shift.v2";
  const tokenKey = "campus-stores.token";
  const root = document.getElementById("campus-stores");
  const loginScreen = document.querySelector("[data-login]");
  const q = (selector) => root.querySelector(selector);

  /* ------------------------------------------------------------------ */
  /* Sample records (fictional)                                          */
  /* ------------------------------------------------------------------ */
  const requests = [
    {
      id: "RQ-214",
      club: "Film Society",
      event: "Courtyard screening",
      owner: "Isha Rao",
      due: "Fri 8 pm",
      items: ["HDMI projector", "Portable speaker", "USB-C → HDMI adapter"],
      note: "Playback is from a USB-C-only laptop. The host will collect at 4 pm.",
    },
    {
      id: "RQ-209",
      club: "Debate Union",
      event: "Finals rehearsal",
      owner: "Tara Shah",
      due: "Sat 10 am",
      items: ["Wireless microphone"],
      note: "Rehearsal runs into the evening.",
    },
    {
      id: "RQ-217",
      club: "Photo Circle",
      event: "Street portrait walk",
      owner: "Dev Menon",
      due: "Sat noon",
      items: ["Digital camera"],
      note: "Collection on Saturday morning.",
    },
  ];
  // People a requester has authorised in writing to collect on their behalf.
  const delegations = {
    "RQ-214": [{ name: "Kabir Sen", source: "Desk book · Isha Rao, Fri 3:20 pm" }],
  };
  const assets = [
    { id: "PR-04", type: "HDMI projector", model: "BenQ MH550", bin: "A2" },
    { id: "PR-06", type: "HDMI projector", model: "Epson EB-X49", bin: "Workshop" },
    { id: "SP-02", type: "Portable speaker", model: "JBL Eon One", bin: "B1" },
    { id: "SP-05", type: "Portable speaker", model: "Bose S1", bin: "B2" },
    { id: "AD-12", type: "USB-C → HDMI adapter", model: "Belkin AVC002", bin: "C4" },
    { id: "AD-15", type: "USB-C → HDMI adapter", model: "Anker A8312", bin: "C4" },
    { id: "MI-09", type: "Wireless microphone", model: "Shure BLX", bin: "B3" },
    { id: "CA-03", type: "Digital camera", model: "Sony A6400", bin: "D2" },
  ];
  const people = ["Isha Rao", "Kabir Sen", "Leela Das", "Tara Shah", "Dev Menon"];
  // `at` is minutes from Friday 00:00, so desk time can be compared with due times.
  const shifts = [
    {
      time: "Friday · 3:45 pm",
      short: "Fri 3:45 pm",
      step: "Pickup",
      at: 945,
      title: "Pickup at the counter",
      text: "Kabir is here for the Film Society screening. The film starts at four. Can he leave with everything he needs?",
      next: "Move to return time",
    },
    {
      time: "Friday · 7:30 pm",
      short: "Fri 7:30 pm",
      step: "Return",
      at: 1170,
      title: "The kit comes back in pieces",
      text: "Kabir has brought back the projector and speaker. “Leela still has the adapter. She’ll drop it off tomorrow at nine.” Take the return and hand over to the morning shift.",
      next: "Move to next morning",
    },
    {
      time: "Saturday · 9:00 am",
      short: "Sat 9:00 am",
      step: "Handover",
      at: 1980,
      title: "Morning shift",
      text: "You’ve just taken over. Leela walks in with an adapter. Work out what was outstanding from the screening and close the loan for the right item.",
    },
  ];
  const slots = [
    ["Fri 8 pm", 1200],
    ["Sat 9 am", 1980],
    ["Sat 10 am", 2040],
    ["Sat noon", 2160],
  ];
  const messages = [
    {
      phase: 0,
      at: 920,
      time: "Friday · 3:20 pm",
      author: "Isha Rao · Film Society",
      text: "Kabir Sen is picking up our whole screening kit. Please issue it in his name. I’m setting up in the courtyard.",
    },
    {
      phase: 0,
      at: 930,
      time: "Friday · 3:30 pm",
      author: "Tara Shah · Debate Union",
      text: "Our microphone stays with me overnight. I’ll return it by 10 am Saturday.",
    },
    {
      phase: 1,
      at: 1170,
      time: "Friday · 7:30 pm",
      author: "Kabir Sen · Film Society",
      text: "I brought the projector and speaker. Leela Das has our adapter. She’ll be at the counter at 9 am tomorrow.",
    },
  ];
  const pages = [
    ["Requests", "clipboard-list"],
    ["Inventory", "package"],
    ["Loan register", "book-open"],
    ["Desk book", "messages-square"],
  ];
  const filters = ["All items", "On shelf", "On loan", "In repair", "Lost"];

  const original = () => ({
    version: 2,
    tab: "Requests",
    phase: 0,
    selected: "",
    filter: "All items",
    scope: "open",
    feed: "notes",
    loans: [
      {
        num: 401,
        req: "RQ-209",
        asset: "MI-09",
        who: "Tara Shah",
        holder: "Tara Shah",
        due: "Sat 10 am",
        expected: "",
        issuedAt: "before this shift",
        back: false,
      },
    ],
    notes: [],
    repair: ["PR-06"],
    lost: [],
    phones: {},
    log: [],
    panel: null,
    undo: null,
    notice: "Sample shift · All records are fictional.",
    tone: "",
  });
  let s = original();
  let user = null;
  let expiryTimer = 0;

  /* ------------------------------------------------------------------ */
  /* Lookups and derived state                                           */
  /* ------------------------------------------------------------------ */
  const now = () => shifts[s.phase].at;
  const slotAt = (d) => {
    const x = slots.find(([n]) => n === d);
    return x ? x[1] : Infinity;
  };
  const getAsset = (id) => assets.find((a) => a.id === id);
  const getReq = (id) => requests.find((r) => r.id === id);
  const getLoan = (num) => s.loans.find((l) => l.num === num);
  const openLoan = (id) => s.loans.find((l) => l.asset === id && !l.back);
  const inRepair = (id) => s.repair.includes(id);
  const isLost = (id) => s.lost.includes(id);
  // Contact numbers by person, collected at pickup and whenever the holder changes.
  const phoneOf = (name) => (s.phones && s.phones[name]) || "";
  const withPhone = (name) => name + (phoneOf(name) ? " (" + phoneOf(name) + ")" : "");
  function cleanPhone(v) {
    const t = String(v || "").trim().replace(/\s+/g, " ");
    return /^\+?\d{7,15}$/.test(t.replace(/[\s().-]/g, "")) ? t : "";
  }
  const phoneInput = (forName) =>
    '<label><span>Phone</span><input name="phone" type="tel" inputmode="tel" autocomplete="off" maxlength="20" required placeholder="e.g. 98765 43210" value="' +
    esc(phoneOf(forName)) +
    '" /></label>';
  const holderOf = (l) => l.holder || l.who;
  const unitStatus = (a) =>
    isLost(a.id) ? "Lost" : inRepair(a.id) ? "In repair" : openLoan(a.id) ? "On loan" : "On shelf";
  const authorised = (r) => [
    { name: r.owner, source: "Requester" },
    ...(delegations[r.id] || []),
  ];
  const span = (m) => (m < 60 ? m + " min" : Math.round(m / 60) + " h");
  const nextNum = () => Math.max(400, ...s.loans.map((l) => l.num)) + 1;
  // Tags are printed like "AD-12"; accept "ad12", " AD 12 " and similar.
  const normTag = (v) =>
    String(v || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .replace(/^([A-Z]+)(\d+)$/, "$1-$2");

  function loanState(l) {
    if (l.lost) return { label: "Lost", tone: "late" };
    if (l.back) return { label: "Returned", tone: "done" };
    const left = slotAt(l.due) - now();
    if (left < 0) return { label: "Overdue " + span(-left), tone: "late" };
    if (left === 0) return { label: "Due now", tone: "soon" };
    if (left <= 120) return { label: "Due in " + span(left), tone: "soon" };
    return { label: "Out", tone: "out" };
  }
  function reqLines(r) {
    return r.items.map((type) => {
      const ls = s.loans.filter(
        (l) => l.req === r.id && getAsset(l.asset).type === type,
      );
      const open = ls.find((l) => !l.back);
      const loan = open || ls[ls.length - 1] || null;
      return { type, loan, state: open ? "out" : loan ? (loan.lost ? "lost" : "back") : "none" };
    });
  }
  function reqState(r) {
    const lines = reqLines(r);
    const st = lines.map((x) => x.state);
    const lost = st.filter((x) => x === "lost").length;
    if (lines.some((x) => x.state === "out" && loanState(x.loan).tone === "late"))
      return { label: "Overdue item", tone: "late" };
    if (st.every((x) => x === "none")) return { label: "Awaiting pickup", tone: "" };
    if (st.every((x) => x === "back")) return { label: "Complete", tone: "done" };
    if (st.every((x) => x === "back" || x === "lost"))
      return { label: "Closed · " + lost + " lost", tone: "late" };
    if (st.includes("none")) return { label: "Partly issued", tone: "soon" };
    if (st.includes("back") || lost) return { label: "Partly returned", tone: "soon" };
    return { label: "Out", tone: "out" };
  }
  // Automatic Desk book entry, written whenever the register or inventory changes.
  function post(source, text, slips = []) {
    s.notes.push({ phase: s.phase, text, slips, auto: true, source, by: user ? user.name : "" });
  }
  function log(text) {
    s.log.unshift({ at: shifts[s.phase].time, by: user ? user.name : "", text });
    s.log.length = Math.min(s.log.length, 80);
  }

  /* ------------------------------------------------------------------ */
  /* Markup helpers                                                      */
  /* ------------------------------------------------------------------ */
  const esc = (x) =>
    String(x).replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const opts = (list, selected = "") =>
    list
      .map(
        ([v, t]) =>
          '<option value="' +
          esc(v) +
          '"' +
          (v === selected ? " selected" : "") +
          ">" +
          esc(t) +
          "</option>",
      )
      .join("");
  const btn = (label, act, val = "", cls = "") =>
    '<button type="button" data-action="' +
    act +
    '" data-val="' +
    esc(val) +
    '" class="' +
    cls +
    '">' +
    esc(label) +
    "</button>";
  const head = (title, sub, control = "") =>
    '<div class="sectionhead"><div><h2>' +
    esc(title) +
    "</h2><small>" +
    esc(sub) +
    "</small></div>" +
    control +
    "</div>";
  const row = (label, sub, right) =>
    '<div class="row"><div><strong>' +
    esc(label) +
    "</strong><small>" +
    esc(sub) +
    "</small></div><div>" +
    right +
    "</div></div>";
  const chip = (t, tone = "") =>
    '<span class="chip ' + tone + '">' + esc(t) + "</span>";
  const seg = (action, current, items) =>
    '<div class="seg" role="group">' +
    items
      .map(
        ([v, t, n]) =>
          '<button type="button" data-action="' +
          action +
          '" data-val="' +
          esc(v) +
          '" aria-pressed="' +
          (current === v) +
          '">' +
          esc(t) +
          ' <span class="n">' +
          n +
          "</span></button>",
      )
      .join("") +
    "</div>";
  function fail(form, msg) {
    let p = form.querySelector(".formerror");
    if (!p) {
      p = document.createElement("p");
      p.className = "formerror";
      p.setAttribute("role", "alert");
      const actions = form.querySelector(".actions");
      if (actions) actions.before(p);
      else form.append(p);
    }
    p.textContent = msg;
  }

  /* ------------------------------------------------------------------ */
  /* Requests                                                            */
  /* ------------------------------------------------------------------ */
  function requestPage() {
    if (s.selected) return requestDetail(getReq(s.selected));
    let html = head(
      "Approved requests",
      "Student Activities Office · " + requests.length + " approved forms · progress per item",
    );
    html += '<div class="list">';
    for (const r of requests) {
      const lines = reqLines(r);
      const st = reqState(r);
      const out = lines.filter((x) => x.state === "out").length;
      const back = lines.filter((x) => x.state === "back").length;
      html +=
        '<button type="button" class="reqrow" data-action="request" data-val="' +
        esc(r.id) +
        '"><span><strong>' +
        esc(r.event) +
        "</strong><small>" +
        esc(r.club + " · " + r.id + " · return by " + r.due) +
        '</small></span><span class="pips" title="' +
        esc(out + " out · " + back + " returned · " + lines.length + " approved") +
        '">' +
        lines
          .map((x) => '<i class="pip ' + x.state + '" title="' + esc(x.type) + '"></i>')
          .join("") +
        "</span>" +
        chip(st.label, st.tone) +
        "</button>";
    }
    return (
      html +
      '</div><div class="reqlegend"><span><i class="pip"></i>Not issued</span><span><i class="pip out"></i>Out</span><span><i class="pip back"></i>Returned</span></div>'
    );
  }
  function requestDetail(r) {
    const st = reqState(r);
    const lines = reqLines(r);
    const auth = authorised(r);
    let html =
      '<div class="crumbs">' + btn("← All requests", "close", "", "ghost") + "</div>";
    html += head(r.event, r.club + " · " + r.id + " · filed by " + r.owner, chip(st.label, st.tone));
    html +=
      '<div class="split"><div class="col"><div class="facts"><div><span class="label">Return by</span><strong>' +
      esc(r.due) +
      '</strong></div><div><span class="label">Authorised to collect</span><strong>' +
      esc(auth.map((a) => a.name).join(", ")) +
      "</strong><small>" +
      esc(auth.map((a) => a.name + ": " + a.source).join(" · ")) +
      "</small></div></div>";
    html += '<p class="memo">' + esc(r.note) + "</p>";
    html += '<h3 class="sub">Approved equipment</h3><div class="list">';
    for (const x of lines) {
      let detail = "Not issued yet";
      let right = chip("Waiting");
      if (x.loan) {
        const a = getAsset(x.loan.asset);
        detail =
          a.id +
          " · " +
          a.model +
          " · slip L-" +
          x.loan.num +
          " · " +
          (x.loan.lost
            ? "reported lost " + x.loan.returnedAt + " by " + x.loan.returnedBy
            : x.loan.back
            ? "returned " + x.loan.returnedAt + " by " + x.loan.returnedBy
            : "with " + holderOf(x.loan) +
              (x.loan.expected ? ", expected " + x.loan.expected : ""));
        const ls = loanState(x.loan);
        right = chip(ls.label, ls.tone);
      }
      html += row(x.type, detail, right);
    }
    html += '</div></div><aside class="side">';
    const pending = lines.filter((x) => x.state === "none").length;
    const out = lines.filter((x) => x.state === "out").length;
    if (s.panel && s.panel.kind === "issue") html += issueForm(r.id, false);
    else if (pending)
      html +=
        '<div class="panel"><div class="panelhead"><h3>Ready for pickup</h3></div><p>' +
        pending +
        " of " +
        lines.length +
        ' approved items still to issue.</p><ol class="steplist"><li>Check the collector is on the authorised list.</li><li>Take each unit off the shelf and pick its tag.</li><li>Hand over and confirm the return time.</li></ol><div class="actions">' +
        btn("Issue equipment", "issue", r.id, "primary") +
        "</div></div>";
    else
      html +=
        '<div class="panel"><div class="panelhead"><h3>' +
        (out ? "Out with the club" : "Request complete") +
        "</h3></div><p>" +
        (out
          ? out + " item" + (out > 1 ? "s" : "") + " still out. Check them in from the Loan register by tag."
          : "Every approved item is back at the desk.") +
        "</p></div>";
    return html + "</aside></div>";
  }
  function issueForm(reqId, pickRequest) {
    const r = getReq(reqId);
    let html =
      '<form class="panel" data-issue><div class="panelhead"><h3>Issue equipment</h3>' +
      btn("Cancel", "cancel", "", "ghost") +
      "</div>";
    if (pickRequest)
      html +=
        '<label class="full"><span>Approved request</span><select data-pickreq><option value="">Select…</option>' +
        opts(requests.map((x) => [x.id, x.id + " · " + x.club + " · " + x.event]), reqId) +
        "</select></label>";
    if (!r) return html + "</form>";
    const pending = reqLines(r)
      .map((x, i) => [x, i])
      .filter(([x]) => x.state === "none");
    if (!pending.length)
      return (
        html +
        '<p class="muted">Everything approved on ' +
        esc(r.id) +
        " has already been issued.</p></form>"
      );
    // Read the tag off each unit as it leaves the shelf, the same way returns are checked in.
    html += '<div class="kit">';
    for (const [x, i] of pending) {
      const units = assets.filter((a) => a.type === x.type && unitStatus(a) === "On shelf");
      const blocked = assets.filter((a) => a.type === x.type && unitStatus(a) !== "On shelf");
      const bins = [...new Set(units.map((a) => a.bin))].join(", ");
      const where = units.length
        ? units.length + " on shelf " + bins
        : "None on the shelf";
      html +=
        '<div class="tagfield' +
        (pending.length % 2 && x === pending[pending.length - 1][0] ? " full" : "") +
        '"><div class="tagtop"><label for="unit-' +
        i +
        '">' +
        esc(x.type) +
        '</label><label class="later"><input type="checkbox" name="later-' +
        i +
        '" /> Later</label></div><input id="unit-' +
        i +
        '" name="unit-' +
        i +
        '" autocomplete="off" spellcheck="false" placeholder="Read the tag" /><small class="hint">' +
        esc(where + (blocked.length ? " · " + blocked.map((a) => a.id + " " + unitStatus(a).toLowerCase()).join(" · ") : "")) +
        "</small></div>";
    }
    html += "</div>";
    const auth = authorised(r);
    const dues = slots.filter(([, at]) => at > now() && at <= slotAt(r.due));
    html +=
      '<div class="form"><label><span>Collected by</span><select name="who" required><option value="">Select…</option>' +
      opts(auth.map((a) => [a.name, a.name])) +
      "</select></label>" +
      phoneInput("");
    html += dues.length
      ? '<label><span>Return by</span><select name="due" required>' +
        opts(dues.map(([d]) => [d, d]), r.due) +
        '</select></label><small class="formnote">Only people on the request or authorised in writing can collect. Return-by is capped at ' +
        esc(r.due) +
        ".</small>"
      : '<p class="formerror full">The approved return time (' + esc(r.due) + ") has passed.</p>";
    html +=
      '</div><div class="actions"><button type="submit" class="primary">Issue to collector</button></div></form>';
    return html;
  }
  function issueProblem(r, id, who, due, type) {
    const a = getAsset(id);
    if (!a) return "No unit is tagged “" + (id || "…") + "”. Read the label again.";
    if (type && a.type !== type) return id + " is a " + a.type + ", not a " + type + ". Check which unit you picked up.";
    if (isLost(id)) return id + " is marked lost. Mark it found in Inventory before issuing it.";
    if (inRepair(id)) return id + " is in repair and can’t leave the desk.";
    const l = openLoan(id);
    if (l) return id + " is already out on slip L-" + l.num + ".";
    if (!r.items.includes(a.type)) return a.type + " isn’t on " + r.id + "’s approved list.";
    if (s.loans.some((x) => x.req === r.id && !x.back && getAsset(x.asset).type === a.type))
      return r.id + " already has a " + a.type + " out.";
    if (!authorised(r).some((p) => p.name === who))
      return (who || "This person") + " isn’t authorised to collect for " + r.id + ".";
    if (!slots.some(([n]) => n === due)) return "Choose a return time.";
    if (slotAt(due) > slotAt(r.due)) return "Return-by can’t be later than the approved " + r.due + ".";
    if (slotAt(due) <= now()) return "That return time has already passed.";
    return "";
  }

  /* ------------------------------------------------------------------ */
  /* Inventory                                                           */
  /* ------------------------------------------------------------------ */
  function inventory() {
    const count = (f) =>
      f === "All items" ? assets.length : assets.filter((a) => unitStatus(a) === f).length;
    let html = head("Inventory", "Physical units · home shelf and where each one is right now");
    html += seg("filter", s.filter, filters.map((f) => [f, f, count(f)]));
    html += '<div class="unitgrid">';
    let shown = 0;
    for (const a of assets) {
      const status = unitStatus(a);
      if (s.filter !== "All items" && s.filter !== status) continue;
      shown++;
      const l = openLoan(a.id);
      let where = "Shelf " + a.bin;
      let tone = "";
      let label = status;
      let action = "";
      if (status === "Lost") {
        const ll = s.loans.filter((x) => x.asset === a.id && x.lost).pop();
        where = "Reported lost" + (ll ? " · L-" + ll.num + " · " + ll.returnedAt : "");
        tone = "late";
        action = btn("Mark found", "found", a.id, "");
      } else if (status === "In repair") {
        where = "Workshop";
        tone = "soon";
      } else if (l) {
        const st = loanState(l);
        where =
          "With " + holderOf(l) + " · L-" + l.num + " · " + getReq(l.req).club + " · due " + l.due;
        tone = st.tone === "late" ? "late" : "out";
        label = st.tone === "late" ? "Overdue" : "On loan";
      }
      html +=
        '<div class="unit"><span class="mono">' +
        esc(a.id) +
        "</span><div><strong>" +
        esc(a.type) +
        "</strong><small>" +
        esc(a.model + " · " + where) +
        '</small></div><div class="unitside">' +
        chip(label, tone) +
        action +
        "</div></div>";
    }
    if (!shown) html += '<p class="empty">No units match this filter.</p>';
    return html + "</div>";
  }

  /* ------------------------------------------------------------------ */
  /* Loan register                                                       */
  /* ------------------------------------------------------------------ */
  function register() {
    const p = s.panel;
    const issuing = p && p.kind === "issue";
    let html = head(
      "Loan register",
      "One slip per physical unit · check in by the tag on the unit in hand",
      issuing ? "" : btn("Issue equipment", "issue", "", "primary"),
    );
    const open = s.loans.filter((l) => !l.back);
    const late = open.filter((l) => loanState(l).tone === "late");
    const soon = open.filter((l) => loanState(l).tone === "soon");
    const stat = (v, label, n, hot) =>
      '<button type="button" class="stat' +
      (hot ? " hot" : "") +
      '" data-action="scope" data-val="' +
      v +
      '" aria-pressed="' +
      (s.scope === v) +
      '"><strong>' +
      n +
      "</strong><span>" +
      label +
      "</span></button>";
    html += '<div class="split"><div class="col">';
    html +=
      '<div class="stats" role="group" aria-label="Loans at a glance · filter the slips">' +
      stat("open", "Out now", open.length, false) +
      stat("late", "Overdue", late.length, late.length > 0) +
      stat("soon", "Due ≤ 2 h", soon.length, soon.length > 0) +
      stat("all", "All slips", s.loans.length, false) +
      "</div>";
    const list = s.loans
      .filter(
        (l) =>
          s.scope === "all" ||
          (!l.back &&
            (s.scope === "open" || loanState(l).tone === (s.scope === "late" ? "late" : "soon"))),
      )
      .slice()
      .reverse();
    if (!list.length)
      html +=
        '<p class="empty">' +
        ({
          late: "Nothing is overdue.",
          soon: "Nothing is due in the next two hours.",
        }[s.scope] || "No outstanding slips.") +
        "</p>";
    html += '<div class="list">' + list.map(slipRow).join("") + "</div></div>";
    const l = p && p.num ? getLoan(p.num) : null;
    const rest = p && p.kind === "rest" && getReq(p.req) ? restForm(getReq(p.req)) : "";
    let side;
    if (issuing) side = issueForm(p.req, true);
    else if (rest) side = rest;
    else if (l && !l.back) side = p.kind === "return" ? returnForm(l) : manageForm(l, p.kind);
    else
      side =
        '<form class="panel" data-checkin><div class="panelhead"><h3>Check in a unit</h3></div><p class="muted">Start from the unit in hand. Read the tag on its label and the desk finds the slip it belongs to.</p><label><span>Asset tag</span><input name="tag" autocomplete="off" spellcheck="false" placeholder="e.g. AD-12" required /></label><div class="actions"><button type="submit" class="primary">Find slip</button></div></form>';
    return html + '<aside class="side">' + side + "</aside></div>";
  }
  function slipRow(l) {
    const a = getAsset(l.asset);
    const r = getReq(l.req);
    const st = loanState(l);
    const lines = [r.club + " · " + r.id + " · issued to " + l.who + " · " + l.issuedAt];
    const contact = !l.back && phoneOf(holderOf(l)) ? " · ☎ " + phoneOf(holderOf(l)) : "";
    if (l.lost) lines.push("Reported lost " + l.returnedAt + " by " + l.returnedBy);
    else if (l.back)
      lines.push("Returned " + l.returnedAt + " by " + l.returnedBy + " · " + l.condition);
    else if (holderOf(l) !== l.who || l.expected)
      lines.push(
        "Now with " + holderOf(l) + contact + (l.expected ? " · expected " + l.expected : "") + " · due " + l.due,
      );
    else lines.push("Due " + l.due + (contact ? " · " + holderOf(l) + contact : ""));
    const rem = l.reminders || [];
    if (rem.length && !l.back) {
      const last = rem[rem.length - 1];
      lines.push(
        "Reminded " + rem.length + "× · last " + last.at + ", " + last.via.toLowerCase() + " to " + last.to,
      );
    }
    let side = chip(st.label, st.tone);
    if (!l.back)
      side +=
        '<div class="actions">' +
        btn("Manage", "holder", String(l.num), "") +
        btn("Check in", "return", String(l.num), "primary") +
        "</div>";
    const selected = s.panel && s.panel.num === l.num && !l.back;
    return (
      '<div class="slip' +
      (st.tone === "late" ? " late" : "") +
      (selected ? " sel" : "") +
      '"><div class="slipno">L-' +
      l.num +
      '</div><div class="slipmain"><strong>' +
      esc(a.id + " · " + a.type) +
      "</strong>" +
      lines.map((t) => "<small>" + esc(t) + "</small>").join("") +
      '</div><div class="slipside">' +
      side +
      "</div></div>"
    );
  }
  function returnForm(l) {
    const a = getAsset(l.asset);
    return (
      '<form class="panel" data-return><div class="panelhead"><h3>Check in slip L-' +
      l.num +
      "</h3>" +
      btn("Cancel", "cancel", "", "ghost") +
      '</div><p class="muted">This slip is for <b>' +
      esc(a.id) +
      "</b>: " +
      esc(a.type + ", " + a.model) +
      ". Read the tag on the unit in hand before you close it.</p>" +
      '<div class="form"><label><span>Tag on the unit in hand</span><input name="tag" autocomplete="off" spellcheck="false" required placeholder="Read it off the label" value="' +
      esc(s.panel.tag || "") +
      '" /></label><label><span>Returned by</span><select name="by" required>' +
      opts(people.map((p) => [p, p]), holderOf(l)) +
      '</select></label><fieldset class="full"><legend>Condition</legend><label class="radio"><input type="radio" name="cond" value="Good" checked /> Good — back to shelf ' +
      esc(a.bin) +
      '</label><label class="radio"><input type="radio" name="cond" value="Needs check" /> Needs check — send to repair</label></fieldset></div>' +
      '<div class="actions"><button type="submit" class="primary">Close slip L-' +
      l.num +
      "</button></div></form>"
    );
  }
  // Follow-up on an open slip: who has it, chase it, or close it as lost.
  function manageForm(l, mode) {
    const a = getAsset(l.asset);
    const modes = [
      ["holder", "Who has it"],
      ["remind", "Remind"],
      ["lost", "Report lost"],
    ];
    const m = modes.some(([k]) => k === mode) ? mode : "holder";
    let html =
      '<div class="panel"><div class="panelhead"><h3>L-' +
      l.num +
      " · " +
      esc(a.id) +
      "</h3>" +
      btn("Cancel", "cancel", "", "ghost") +
      '</div><div class="seg" role="group" aria-label="Follow-up">' +
      modes
        .map(
          ([k, t]) =>
            '<button type="button" data-action="mode" data-val="' +
            k +
            '" aria-pressed="' +
            (m === k) +
            '">' +
            t +
            "</button>",
        )
        .join("") +
      "</div>";
    if (m === "holder") html += holderForm(l);
    else if (m === "remind") html += remindForm(l);
    else html += lostForm(l);
    return html + "</div>";
  }
  function holderForm(l) {
    const expected = slots.filter(([, at]) => at >= now()).map(([d]) => [d, d]);
    return (
      '<form class="panel" data-holder><p class="muted">Use this when the person holding the unit changes. The slip stays open and the next shift sees it in the Desk book.</p><div class="form"><label><span>Now held by</span><select name="holder" required>' +
      opts(people.map((p) => [p, p]), holderOf(l)) +
      "</select></label>" +
      phoneInput(holderOf(l)) +
      '<label><span>Expected back</span><select name="expected" required>' +
      opts(expected, l.expected) +
      '</select></label><label><span>Note (optional)</span><input name="note" maxlength="200" placeholder="e.g. Bringing it at 9" /></label></div><div class="actions"><button type="submit" class="primary">Save holder</button></div></form>'
    );
  }
  function remindForm(l) {
    const r = getReq(l.req);
    const to = [...new Set([holderOf(l), l.who, r.owner])];
    const st = loanState(l);
    const rem = l.reminders || [];
    return (
      '<form class="panel" data-remind><p class="muted">' +
      esc(st.label) +
      ". Log each chase so the next shift doesn’t ask the same person twice.</p>" +
      (rem.length
        ? "<small>" +
          esc(rem.map((x) => x.at + ": " + x.via.toLowerCase() + " to " + x.to).join(" · ")) +
          "</small>"
        : "") +
      '<ul class="phonebook">' +
      to
        .map(
          (p) =>
            "<li><span>" +
            esc(p) +
            "</span>" +
            (phoneOf(p)
              ? '<a class="mono" href="tel:' + esc(phoneOf(p).replace(/[^+\d]/g, "")) + '">' + esc(phoneOf(p)) + "</a>"
              : "<small>No number on file</small>") +
            "</li>",
        )
        .join("") +
      "</ul>" +
      '<div class="form"><label><span>Remind</span><select name="to" required>' +
      opts(to.map((p) => [p, p + (p === holderOf(l) ? " (has it)" : p === r.owner ? " (requester)" : "")])) +
      '</select></label><label><span>How</span><select name="via" required>' +
      opts(["Message", "Phone call", "In person"].map((v) => [v, v])) +
      '</select></label><label class="full"><span>Note (optional)</span><input name="note" maxlength="200" placeholder="e.g. Says she’s on her way" /></label></div><div class="actions"><button type="submit" class="primary">Log reminder</button></div></form>'
    );
  }
  function lostForm(l) {
    const a = getAsset(l.asset);
    return (
      '<form class="panel" data-lost><p class="muted">Only when the unit can’t be found. The slip closes as lost and ' +
      esc(a.id) +
      ' leaves stock until someone marks it found in Inventory.</p><div class="form"><label class="full"><span>Reported by</span><select name="by" required>' +
      opts(people.map((p) => [p, p]), holderOf(l)) +
      '</select></label><label class="full"><span>What happened</span><textarea name="what" rows="2" maxlength="300" required placeholder="e.g. Left in the courtyard after the screening"></textarea></label><label class="radio full"><input type="checkbox" name="checked" /> <span class="opt">I checked the shelf, the return tray and the Desk book</span></label></div><div class="actions"><button type="submit" class="primary">Close slip as lost</button></div></form>'
    );
  }
  // After a partial return: ask where the rest of the kit is while the borrower is still at the counter.
  function restForm(r) {
    const out = reqLines(r)
      .filter((x) => x.state === "out")
      .map((x) => x.loan);
    if (!out.length) return "";
    const holders = [...new Set(out.map(holderOf))];
    const expected = slots.filter(([, at]) => at >= now()).map(([d]) => [d, d]);
    return (
      '<form class="panel" data-rest><div class="panelhead"><h3>Who has the rest?</h3></div><p class="muted">' +
      esc(r.id + " · " + r.club) +
      " still has " +
      out.length +
      " item" +
      (out.length > 1 ? "s" : "") +
      " out. If someone other than " +
      esc(holders.join(" or ")) +
      " has " +
      (out.length > 1 ? "them" : "it") +
      ', record it now so the next shift knows where to look.</p><fieldset class="restlist">' +
      out
        .map(
          (l) =>
            '<label class="radio"><input type="checkbox" name="slip" value="' +
            l.num +
            '" checked /> <span class="opt"><b>' +
            esc(l.asset) +
            "</b> " +
            esc(getAsset(l.asset).type + " · with " + holderOf(l)) +
            "</span></label>",
        )
        .join("") +
      '</fieldset><div class="form"><label><span>Now held by</span><select name="holder" required>' +
      opts(people.map((p) => [p, p]), holders[0]) +
      "</select></label>" +
      phoneInput(holders[0]) +
      '<label><span>Expected back</span><select name="expected" required>' +
      opts(expected, out[0].expected) +
      '</select></label><label><span>Note (optional)</span><input name="note" maxlength="200" placeholder="e.g. Bringing it at 9" /></label></div><div class="actions"><button type="submit" class="primary">Save</button>' +
      btn("Still with " + holders.join(" & "), "keep", r.id, "") +
      "</div></form>"
    );
  }

  /* ------------------------------------------------------------------ */
  /* Desk book                                                           */
  /* ------------------------------------------------------------------ */
  function deskbook() {
    let html = head("Desk book", "Messages from clubs and notes for the next shift");
    const open = s.loans.filter((l) => !l.back);
    html +=
      '<div class="split desk"><section class="handover"><div class="handhead"><h3>Open at ' +
      esc(shifts[s.phase].short) +
      "</h3><small>Built from the loan register: what the next shift inherits</small></div>";
    html += open.length
      ? '<ul class="handlist">' +
        open
          .map((l) => {
            const a = getAsset(l.asset);
            const st = loanState(l);
            return (
              '<li><span class="mono">L-' +
              l.num +
              "</span><span><b>" +
              esc(a.id) +
              "</b> " +
              esc(
                a.type +
                  " · " +
                  getReq(l.req).club +
                  " · with " +
                  withPhone(holderOf(l)) +
                  (l.expected ? " · expected " + l.expected : ""),
              ) +
              "<br />" +
              chip(st.label, st.tone) +
              "</span></li>"
            );
          })
          .join("") +
        "</ul>"
      : '<p class="empty">Nothing outstanding.</p>';
    html += "</section>";

    const entries = messages
      .filter((m) => m.phase <= s.phase)
      .map((m) => ({ ...m, kind: "msg" }))
      .concat(
        s.notes.map((n, i) => ({
          at: shifts[n.phase].at + 0.5 + i / 1000,
          time: shifts[n.phase].time,
          author: (n.auto ? n.source || "Loan register" : "Handover note") + (n.by ? " · " + n.by : ""),
          text: n.text,
          slips: Array.isArray(n.slips) ? n.slips : n.slip ? [n.slip] : [],
          kind: n.auto ? "note auto" : "note",
        })),
      )
      .sort((a, b) => b.at - a.at);
    html +=
      '<section class="feedcard" aria-label="Handovers"><div class="feedhead">' +
      seg("feed", s.feed, [
        ["notes", "Handovers", entries.length],
        ["log", "Activity log", s.log.length],
      ]) +
      '</div><div class="feed" tabindex="0">';
    if (s.feed === "log")
      html += s.log.length
        ? '<ol class="loglist">' +
          s.log
            .map(
              (x) =>
                "<li><small>" +
                esc(x.at) +
                "</small><span>" +
                esc(x.text) +
                (x.by ? " <small>· " + esc(x.by) + "</small>" : "") +
                "</span></li>",
            )
            .join("") +
          "</ol>"
        : '<p class="empty">No actions yet this shift.</p>';
    else for (const e of entries) {
      const linked = (e.slips || []).map(getLoan).filter(Boolean);
      html +=
        '<article class="entry ' +
        e.kind +
        '"><small>' +
        esc(e.time) +
        "</small><h3>" +
        esc(e.author) +
        "</h3><p>" +
        esc(e.text) +
        "</p>" +
        (linked.length
          ? '<div class="entrychips">' +
            linked
              .map((l) => chip("L-" + l.num + " · " + l.asset + (l.back ? " · closed" : ""), l.back ? "done" : ""))
              .join("") +
            "</div>"
          : "") +
        "</article>";
    }
    html +=
      '</div><form class="composer" data-note><label><span>Note for the next shift</span><textarea name="note" rows="2" maxlength="400" required placeholder="What does the next shift need to know?"></textarea></label><div class="composerrow"><select name="slip" aria-label="About a slip (optional)"><option value="">Not about a specific slip</option>' +
      opts(open.map((l) => [String(l.num), "About L-" + l.num + " · " + l.asset + " · " + holderOf(l)])) +
      '</select><div class="actions"><button type="submit" class="primary">Add note</button></div></div></form></section></div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /* Paint                                                               */
  /* ------------------------------------------------------------------ */
  const screens = {
    Requests: requestPage,
    Inventory: inventory,
    "Loan register": register,
    "Desk book": deskbook,
  };
  let shown = {};
  function replay(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }
  function paint() {
    const ph = shifts[s.phase];
    q("[data-clock]").textContent = ph.time.replace(" · ", ", ");
    q("[data-shift-time]").textContent =
      "Step " + (s.phase + 1) + " of " + shifts.length + " · " + ph.step;
    q("[data-shift-title]").textContent = ph.title;
    q("[data-shift]").textContent = ph.text;
    const advance = q('[data-action="advance"]');
    advance.hidden = !ph.next;
    advance.textContent = ph.next || "";
    q("[data-steps]").innerHTML = shifts
      .map(
        (x, i) =>
          '<li class="' +
          (i < s.phase ? "done" : i === s.phase ? "now" : "") +
          '"' +
          (i === s.phase ? ' aria-current="step"' : "") +
          "><b>" +
          esc(x.short) +
          "</b><span>" +
          esc(x.step) +
          "</span></li>",
      )
      .join("");
    const open = s.loans.filter((l) => !l.back);
    const counts = {
      Requests: [requests.filter((r) => reqState(r).tone !== "done").length, false],
      "Loan register": [open.length, open.some((l) => loanState(l).tone === "late")],
      "Desk book": [messages.filter((m) => m.phase <= s.phase).length + s.notes.length, false],
    };
    q("[data-nav]").innerHTML = pages
      .map(([n, icon]) => {
        const c = counts[n];
        return (
          '<button type="button" data-action="tab" data-val="' +
          n +
          '" aria-pressed="' +
          (s.tab === n) +
          '" title="' +
          n +
          '"><svg aria-hidden="true" class="store-icon"><use href="#icon-' +
          icon +
          '"></use></svg><span class="navlabel">' +
          n +
          "</span>" +
          (c ? '<span class="navcount' + (c[1] ? " hot" : "") + '">' + c[0] + "</span>" : "") +
          "</button>"
        );
      })
      .join("");
    q("[data-crumb]").textContent =
      s.tab === "Requests" && s.selected ? "Requests · " + getReq(s.selected).event : s.tab;
    // Animate only what changed: a new view rises in, a new side task slides in.
    const pageEl = q("[data-page]");
    const sideKey = s.panel ? [s.panel.kind, s.panel.num || "", s.panel.req || ""].join(":") : "";
    const viewKey = [s.tab, s.selected, s.scope, s.filter, s.feed].join("|");
    pageEl.innerHTML = '<div class="view">' + screens[s.tab]() + "</div>";
    if (viewKey !== shown.view) pageEl.firstChild.classList.add("enter");
    else if (sideKey !== shown.side) {
      const side = pageEl.querySelector(".side");
      if (side) side.classList.add("enter");
    }
    if (s.phase !== shown.phase) replay(q(".shiftcard"), "enter");
    if (s.notice !== shown.notice) replay(q("[data-status]"), "pulse");
    shown = { view: viewKey, side: sideKey, phase: s.phase, notice: s.notice };
    q("[data-status]").textContent = s.notice;
    q(".statusbar").className = "statusbar " + s.tone;
    q('[data-action="undo"]').hidden = !s.undo;
    q("[data-user]").textContent = user ? user.name : "";
    q("[data-user-handle]").textContent = user ? "@" + user.username : "";
    q("[data-user-session]").textContent = user ? user.session : "";
    q("[data-user-session]").title = user ? user.sessionFull : "";
  }
  // Record a refused check-in in the Activity log without redrawing (keeps what was typed).
  function refuse(form, msg) {
    log("Check-in refused: " + msg);
    try {
      localStorage.setItem(storageKey, JSON.stringify(s));
    } catch {
      /* the log entry lasts for this visit */
    }
    return fail(form, msg);
  }
  function commit(msg, tone = "ok") {
    if (msg !== undefined) {
      s.notice = msg;
      s.tone = tone;
    }
    paint();
    try {
      localStorage.setItem(storageKey, JSON.stringify(s));
    } catch {
      q("[data-status]").textContent +=
        " Browser storage is unavailable. Progress lasts for this visit.";
    }
  }
  // Sidebar collapse is a per-browser preference, not part of the shift record.
  const railKey = "campus-stores.rail";
  function setRail(collapsed) {
    root.classList.toggle("collapsed", collapsed);
    const t = q('[data-action="rail"]');
    const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
    t.setAttribute("aria-expanded", String(!collapsed));
    t.setAttribute("aria-label", label);
    t.title = label;
    t.querySelector("use").setAttribute("href", collapsed ? "#icon-panel-open" : "#icon-panel-close");
    try {
      localStorage.setItem(railKey, collapsed ? "1" : "0");
    } catch {
      /* preference lasts for this visit */
    }
  }
  try {
    if (localStorage.getItem(railKey) === "1") setRail(true);
  } catch {
    /* default: expanded */
  }
  const focusPanel = () => {
    const f = q(".panel input:not([type=radio]), .panel select");
    if (f) f.focus();
  };

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const v = b.dataset.val || "";
    switch (b.dataset.action) {
      case "restart":
        if (!confirm("Restart the sample shift? Every record goes back to the start.")) return;
        s = original();
        return commit("Sample shift restarted.", "");
      case "advance":
        if (s.phase >= shifts.length - 1) return;
        s.phase++;
        s.panel = null;
        s.undo = null;
        log("Desk time moved to " + shifts[s.phase].time + ".");
        return commit("Desk time is now " + shifts[s.phase].time + ".");
      case "tab":
        s.tab = v;
        s.panel = null;
        break;
      case "jump": {
        const [where, arg] = v.split(":");
        s.panel = null;
        if (where === "register") {
          s.tab = "Loan register";
          s.scope = arg;
        } else if (where === "inventory") {
          s.tab = "Inventory";
          s.filter = arg;
        } else {
          s.tab = "Requests";
          s.selected = "";
        }
        break;
      }
      case "close":
        s.selected = "";
        s.panel = null;
        break;
      case "request":
        s.selected = v;
        s.panel = null;
        break;
      case "issue":
        s.panel = { kind: "issue", req: v };
        commit();
        return focusPanel();
      case "cancel":
        s.panel = null;
        break;
      case "scope":
        s.scope = v;
        break;
      case "filter":
        s.filter = v;
        break;
      case "feed":
        s.feed = v === "log" ? "log" : "notes";
        break;
      case "return":
      case "holder":
        s.panel = { kind: b.dataset.action, num: Number(v), tag: "" };
        commit();
        return focusPanel();
      case "mode":
        if (s.panel && s.panel.num) s.panel = { ...s.panel, kind: v };
        break;
      case "keep": {
        const r = getReq(v);
        s.panel = null;
        if (r) log("Confirmed the rest of " + r.id + " is still with the same holder.");
        return commit(r ? "Noted: the rest of " + r.id + " stays with the same holder." : undefined);
      }
      case "found": {
        const a = getAsset(v);
        if (!a || !isLost(a.id)) return;
        s.lost = s.lost.filter((id) => id !== a.id);
        s.undo = null;
        post("Inventory", a.id + " (" + a.model + ") was found and is back on shelf " + a.bin + ".");
        log(a.id + " marked found.");
        return commit(a.id + " is back in stock.");
      }
      case "undo": {
        const u = s.undo;
        const l = u && getLoan(u.num);
        if (!l || !l.back) return;
        const wasLost = !!l.lost;
        l.back = false;
        delete l.lost;
        delete l.returnedAt;
        delete l.returnedBy;
        delete l.condition;
        if (u.repaired) s.repair = s.repair.filter((id) => id !== l.asset);
        if (wasLost) s.lost = s.lost.filter((id) => id !== l.asset);
        // Take back the Desk book entries this action posted.
        if (Number.isInteger(u.noteFrom)) s.notes.splice(u.noteFrom);
        s.undo = null;
        s.panel = null;
        log("Undid " + (wasLost ? "lost report" : "check-in") + " of " + l.asset + " · slip L-" + l.num + " reopened.");
        return commit((wasLost ? "Lost report" : "Check-in") + " undone. Slip L-" + l.num + " is open again.");
      }
      case "brief":
        return q("[data-brief]").showModal();
      case "rail":
        return setRail(!root.classList.contains("collapsed"));
      case "signout":
        return signOut("Signed out.");
    }
    commit();
  });

  root.addEventListener("change", (e) => {
    // Picking a person fills in the number already on file for them.
    if (e.target.matches("select[name=who], select[name=holder]")) {
      const phone = e.target.form && e.target.form.querySelector("input[name=phone]");
      if (phone) phone.value = phoneOf(e.target.value);
      return;
    }
    if (e.target.matches("[data-pickreq]")) {
      s.panel = { kind: "issue", req: e.target.value };
      commit();
    }
  });

  root.addEventListener("submit", (e) => {
    const f = e.target;
    if (f.method === "dialog") return;
    e.preventDefault();
    const form = new FormData(f);

    if (f.matches("[data-note]")) {
      const text = String(form.get("note") || "").trim();
      if (!text) return fail(f, "Write a note first.");
      const slip = Number(form.get("slip")) || 0;
      if (slip && !getLoan(slip)) return fail(f, "That slip no longer exists.");
      s.notes.push({ phase: s.phase, text, slips: slip ? [slip] : [], by: user ? user.name : "" });
      s.undo = null;
      log("Added a handover note" + (slip ? " about L-" + slip : "") + ".");
      return commit("Handover note saved.");
    }

    if (f.matches("[data-checkin]")) {
      const tag = normTag(form.get("tag"));
      const a = getAsset(tag);
      if (!a) return fail(f, "No unit is tagged “" + (tag || "…") + "”. Check the label again.");
      const l = openLoan(tag);
      if (!l)
        return refuse(
          f,
          inRepair(tag)
            ? tag + " is in repair, not on loan."
            : isLost(tag)
            ? tag + " is marked lost. If it’s here, mark it found in Inventory first."
            : tag + " (" + a.model + ") is on the shelf in " + a.bin + ", not on loan. Check the label again.",
        );
      s.panel = { kind: "return", num: l.num, tag };
      if ((s.scope === "late" || s.scope === "soon") && loanState(l).tone !== s.scope) s.scope = "open";
      commit("Found slip L-" + l.num + " for " + tag + ".", "");
      return focusPanel();
    }

    if (f.matches("[data-return]")) {
      const l = getLoan(s.panel && s.panel.num);
      if (!l || l.back) return;
      const tag = normTag(form.get("tag"));
      const by = String(form.get("by") || "");
      const cond = form.get("cond") === "Needs check" ? "Needs check" : "Good";
      if (tag !== l.asset) {
        const other = getAsset(tag);
        if (!other) return fail(f, "No unit is tagged “" + (tag || "…") + "”. Read the label again.");
        const ol = openLoan(tag);
        if (ol)
          return refuse(
            f,
            tag + " belongs to slip L-" + ol.num + " (" + getReq(ol.req).club + "), not this one. Leave L-" + l.num + " open.",
          );
        return refuse(
          f,
          tag + " (" + other.model + ") is not on this slip. L-" + l.num + " is for " + l.asset + " (" + getAsset(l.asset).model + "). Leave it open.",
        );
      }
      if (!people.includes(by)) return fail(f, "Choose who returned it.");
      l.back = true;
      l.returnedAt = shifts[s.phase].time;
      l.returnedBy = by;
      l.condition = cond;
      const repaired = cond === "Needs check" && !inRepair(l.asset);
      if (repaired) s.repair.push(l.asset);
      s.panel = null;
      const r = getReq(l.req);
      const complete = reqLines(r).every((x) => x.state === "back");
      const stillOut = reqLines(r).filter((x) => x.state === "out").map((x) => x.loan.asset);
      const a = getAsset(l.asset);
      const noteFrom = s.notes.length;
      post(
        "Loan register",
        a.id + " (" + a.type + ") checked in from " + by + ", condition " + cond.toLowerCase() +
          ". Slip L-" + l.num + " closed. " +
          (complete
            ? "Everything on " + r.id + " (" + r.club + ") is back."
            : stillOut.length
              ? "Still out on " + r.id + ": " + stillOut.join(", ") + "."
              : ""),
        [l.num],
      );
      if (repaired)
        post(
          "Inventory",
          a.id + " (" + a.model + ") moved to repair after its return. Check it before it goes back on shelf " + a.bin + ".",
          [l.num],
        );
      s.undo = { num: l.num, repaired, noteFrom };
      // Partial return: ask where the rest is while the borrower is still at the counter.
      if (stillOut.length) s.panel = { kind: "rest", req: r.id };
      log("Checked in " + l.asset + " from " + by + " · slip L-" + l.num + " closed (" + cond + ").");
      return commit(
        l.asset +
          " checked in from " +
          by +
          ". Slip L-" +
          l.num +
          " closed" +
          (repaired ? " and the unit is flagged for repair." : ".") +
          (complete ? " " + r.id + " is complete." : ""),
      );
    }

    if (f.matches("[data-holder]")) {
      const l = getLoan(s.panel && s.panel.num);
      if (!l || l.back) return;
      const holder = String(form.get("holder") || "");
      const expected = String(form.get("expected") || "");
      const note = String(form.get("note") || "").trim();
      if (!people.includes(holder)) return fail(f, "Choose who has it now.");
      const phone = cleanPhone(form.get("phone"));
      if (!phone) return fail(f, "Enter " + holder + "’s phone number (7–15 digits) so the desk can reach them.");
      if (slotAt(expected) < now()) return fail(f, "Choose a time that hasn’t passed.");
      const prev = holderOf(l);
      s.phones[holder] = phone;
      l.holder = holder;
      l.expected = expected;
      post(
        "Loan register",
        l.asset + " (" + getAsset(l.asset).type + ") is now with " + withPhone(holder) + ", expected back " + expected +
          ". Slip L-" + l.num + " stays open." + (note ? " " + note : ""),
        [l.num],
      );
      s.panel = null;
      s.undo = null;
      log("L-" + l.num + ": holder " + prev + " → " + holder + ", expected " + expected + ".");
      return commit("Slip L-" + l.num + " updated: " + l.asset + " is with " + holder + ".");
    }

    if (f.matches("[data-rest]")) {
      const r = getReq(s.panel && s.panel.req);
      if (!r) return;
      const nums = form
        .getAll("slip")
        .map(Number)
        .filter((n) => {
          const l = getLoan(n);
          return l && !l.back && l.req === r.id;
        });
      if (!nums.length) return fail(f, "Tick the items you’re updating, or choose “Still with…”.");
      const holder = String(form.get("holder") || "");
      const expected = String(form.get("expected") || "");
      const note = String(form.get("note") || "").trim();
      if (!people.includes(holder)) return fail(f, "Choose who has them now.");
      const phone = cleanPhone(form.get("phone"));
      if (!phone) return fail(f, "Enter " + holder + "’s phone number (7–15 digits) so the desk can reach them.");
      if (slotAt(expected) < now()) return fail(f, "Choose a time that hasn’t passed.");
      s.phones[holder] = phone;
      for (const n of nums) {
        const l = getLoan(n);
        l.holder = holder;
        l.expected = expected;
      }
      post(
        "Loan register",
        "Still out on " + r.id + " after a partial return: " +
          nums.map((n) => getLoan(n).asset + " (" + getAsset(getLoan(n).asset).type + ")").join(", ") +
          " with " + withPhone(holder) + ", expected back " + expected + "." + (note ? " " + note : ""),
        nums,
      );
      s.panel = null;
      s.undo = null;
      log(r.id + ": rest of the kit is with " + holder + ", expected " + expected + ".");
      return commit("Recorded: the rest of " + r.id + " is with " + holder + ".");
    }

    if (f.matches("[data-remind]")) {
      const l = getLoan(s.panel && s.panel.num);
      if (!l || l.back) return;
      const to = String(form.get("to") || "");
      const via = String(form.get("via") || "");
      const note = String(form.get("note") || "").trim();
      if (!people.includes(to)) return fail(f, "Choose who you reminded.");
      if (!["Message", "Phone call", "In person"].includes(via)) return fail(f, "Choose how you reminded them.");
      if (via !== "In person" && !phoneOf(to))
        return fail(f, "There’s no number on file for " + to + ". Add it under “Who has it” first.");
      l.reminders = (l.reminders || []).concat({ at: shifts[s.phase].time, to, via, note });
      post(
        "Loan register",
        "Reminder (" + via.toLowerCase() + ") to " + withPhone(to) + " about L-" + l.num + " · " + l.asset +
          ", " + loanState(l).label.toLowerCase() + "." + (note ? " " + note : ""),
        [l.num],
      );
      s.panel = null;
      s.undo = null;
      log("Reminded " + to + " about L-" + l.num + " (" + via.toLowerCase() + ").");
      return commit("Reminder logged for L-" + l.num + ".");
    }

    if (f.matches("[data-lost]")) {
      const l = getLoan(s.panel && s.panel.num);
      if (!l || l.back) return;
      const by = String(form.get("by") || "");
      const what = String(form.get("what") || "").trim();
      if (!people.includes(by)) return fail(f, "Choose who reported it.");
      if (!what) return fail(f, "Say what happened, so whoever finds it knows the story.");
      if (!form.get("checked")) return fail(f, "Check the shelf, the return tray and the Desk book first.");
      const a = getAsset(l.asset);
      const noteFrom = s.notes.length;
      l.back = true;
      l.lost = true;
      l.returnedAt = shifts[s.phase].time;
      l.returnedBy = by;
      l.condition = "Lost";
      if (!isLost(a.id)) s.lost.push(a.id);
      post("Loan register", "L-" + l.num + " · " + a.id + " (" + a.type + ") closed as lost. Reported by " + withPhone(by) + ": " + what, [l.num]);
      post("Inventory", a.id + " (" + a.model + ") is marked lost and can’t be issued until it’s found.", [l.num]);
      s.undo = { num: l.num, repaired: false, noteFrom };
      s.panel = null;
      log("L-" + l.num + " closed as lost (" + a.id + "), reported by " + by + ".");
      return commit("Slip L-" + l.num + " closed as lost. " + a.id + " is out of stock until found.");
    }

    if (f.matches("[data-issue]")) {
      const r = getReq(s.panel && s.panel.req);
      if (!r) return fail(f, "Choose an approved request.");
      const who = String(form.get("who") || "");
      const due = String(form.get("due") || "");
      const picks = [];
      const types = {};
      for (const [i, type] of r.items.entries()) {
        if (!form.has("unit-" + i) || form.get("later-" + i)) continue;
        const tag = normTag(form.get("unit-" + i));
        if (!tag) return fail(f, "Read the tag on the " + type + ", or tick “Later”.");
        picks.push(tag);
        types[tag] = type;
      }
      if (!picks.length) return fail(f, "Nothing to issue: every item is marked “Later”.");
      const phone = cleanPhone(form.get("phone"));
      if (!phone) return fail(f, "Enter the collector’s phone number (7–15 digits) so the desk can reach them if it runs late.");
      for (const id of picks) {
        const p = issueProblem(r, id, who, due, types[id]);
        if (p) return fail(f, p);
      }
      let num = nextNum();
      const made = [];
      const nums = [];
      for (const id of picks) {
        s.loans.push({
          num, req: r.id, asset: id, who, holder: who, due, expected: "",
          issuedAt: shifts[s.phase].time, back: false,
        });
        made.push("L-" + num + " " + id);
        nums.push(num);
        num++;
      }
      s.phones[who] = phone;
      post(
        "Loan register",
        "Issued to " + withPhone(who) + " for " + r.id + " · " + r.club + " (" + r.event + "): " +
          picks.map((id) => id + " " + getAsset(id).type).join(", ") +
          ". Return by " + due + ".",
        nums,
      );
      s.panel = null;
      s.undo = null;
      log("Issued " + picks.join(", ") + " to " + who + " for " + r.id + ", return by " + due + ".");
      return commit(
        "Issued " + picks.length + " item" + (picks.length > 1 ? "s" : "") + " to " + who + ": " + made.join(", ") + ".",
      );
    }
  });

  /* ------------------------------------------------------------------ */
  /* Saved shift                                                         */
  /* ------------------------------------------------------------------ */
  function restore(d) {
    const okLoan = (l) =>
      l &&
      Number.isInteger(l.num) &&
      getReq(l.req) &&
      getAsset(l.asset) &&
      people.includes(l.who) &&
      slots.some(([n]) => n === l.due) &&
      typeof l.back === "boolean";
    if (
      !d ||
      d.version !== 2 ||
      !Object.hasOwn(screens, d.tab) ||
      !shifts[d.phase] ||
      (d.selected && !getReq(d.selected)) ||
      !filters.includes(d.filter) ||
      !["open", "late", "soon", "all"].includes(d.scope) ||
      !Array.isArray(d.loans) ||
      !d.loans.every(okLoan) ||
      !Array.isArray(d.notes) ||
      !d.notes.every((n) => n && shifts[n.phase] && typeof n.text === "string") ||
      !Array.isArray(d.repair) ||
      !d.repair.every(getAsset) ||
      (d.lost !== undefined && (!Array.isArray(d.lost) || !d.lost.every(getAsset))) ||
      !Array.isArray(d.log)
    )
      return;
    s = {
      ...original(),
      ...d,
      loans: d.loans.map((l) => ({ ...l })),
      notes: d.notes.map((n) => ({ ...n })),
      repair: [...d.repair],
      lost: Array.isArray(d.lost) ? [...d.lost] : [],
      phones:
        d.phones && typeof d.phones === "object"
          ? Object.fromEntries(
              Object.entries(d.phones).filter(([k, v]) => people.includes(k) && typeof v === "string"),
            )
          : {},
      log: d.log.filter((x) => x && typeof x.text === "string").map((x) => ({ ...x })),
      feed: d.feed === "log" ? "log" : "notes",
      panel: null,
      undo: null,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Sign-in (JWT issued and verified by server.py)                      */
  /* ------------------------------------------------------------------ */
  const store = {
    get: () => {
      try {
        return sessionStorage.getItem(tokenKey);
      } catch {
        return null;
      }
    },
    set: (t) => {
      try {
        sessionStorage.setItem(tokenKey, t);
      } catch {
        /* token lives in memory only */
      }
    },
    clear: () => {
      try {
        sessionStorage.removeItem(tokenKey);
      } catch {
        /* nothing stored */
      }
    },
  };
  function claims(token) {
    try {
      const body = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const c = JSON.parse(atob(body));
      return { iat: c.iat * 1000, exp: c.exp * 1000 };
    } catch {
      return { iat: 0, exp: 0 };
    }
  }
  const clockTime = (ms) =>
    new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  function showLogin(message = "") {
    user = null;
    clearTimeout(expiryTimer);
    root.hidden = true;
    loginScreen.hidden = false;
    loginScreen.querySelector("[data-login-error]").textContent = message;
    loginScreen.querySelector("input[name=username]").focus();
  }
  function signOut(message) {
    store.clear();
    showLogin(message);
  }
  function start(u, token) {
    const c = claims(token);
    user = {
      ...u,
      session: c.exp ? "Until " + clockTime(c.exp) : "",
      sessionFull: c.exp ? "Signed in " + clockTime(c.iat) + ", session ends " + clockTime(c.exp) : "",
    };
    loginScreen.hidden = true;
    root.hidden = false;
    clearTimeout(expiryTimer);
    const ms = c.exp - Date.now();
    if (ms > 0) expiryTimer = setTimeout(() => signOut("Your session expired. Sign in again."), Math.min(ms, 2 ** 31 - 1));
    s = original();
    try {
      restore(JSON.parse(localStorage.getItem(storageKey)));
    } catch {
      // Keep the fresh shift when storage is unavailable or the saved data is invalid.
    }
    s.notice = "Signed in as " + u.name + ".";
    s.tone = "";
    paint();
  }
  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    let body = {};
    try {
      body = await res.json();
    } catch {
      /* empty body */
    }
    return { ok: res.ok, status: res.status, body };
  }
  loginScreen.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const form = new FormData(f);
    const button = f.querySelector("button[type=submit]");
    const error = f.querySelector("[data-login-error]");
    button.disabled = true;
    error.textContent = "";
    try {
      const res = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: String(form.get("username") || "").trim(),
          password: String(form.get("password") || ""),
        }),
      });
      if (!res.ok) {
        error.textContent = res.body.error || "Sign-in failed.";
        f.querySelector("input[name=password]").select();
        return;
      }
      store.set(res.body.token);
      f.reset();
      start(res.body.user, res.body.token);
    } catch {
      error.textContent = "Can’t reach the desk server. Start it with: python server.py";
    } finally {
      button.disabled = false;
    }
  });
  async function boot() {
    const token = store.get();
    if (!token) return showLogin();
    try {
      const res = await api("/api/me", { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) return signOut("Your session ended. Sign in again.");
      start(res.body.user, token);
    } catch {
      showLogin("Can’t reach the desk server. Start it with: python server.py");
    }
  }
  boot();
})();
