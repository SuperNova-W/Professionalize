(function initGmailReplyOrb() {
  if (window.__gmailReplyOrbMounted) return;
  window.__gmailReplyOrbMounted = true;

  const SERVER_URL = "http://localhost:3789/generate";
  const root = document.createElement("div");
  root.id = "gmail-reply-orb-root";
  root.innerHTML = `
    <button class="gro-orb" type="button" title="Open reply assistant" aria-label="Open reply assistant">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3l1.58 5.23L19 10l-5.42 1.77L12 17l-1.58-5.23L5 10l5.42-1.77L12 3z" fill="currentColor"/>
        <path d="M18 15l.78 2.22L21 18l-2.22.78L18 21l-.78-2.22L15 18l2.22-.78L18 15z" fill="currentColor" opacity=".8"/>
      </svg>
    </button>
    <section class="gro-panel gro-hidden" aria-label="Gmail reply assistant">
      <div class="gro-header">
        <div class="gro-title">Gmail Reply Orb</div>
        <button class="gro-icon-button" type="button" data-action="close" title="Close" aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="gro-body">
        <label class="gro-field">
          <span class="gro-label">How do you want to respond?</span>
          <textarea class="gro-textarea" data-role="instruction" placeholder="Example: politely say I can meet Thursday afternoon and ask them to send the agenda."></textarea>
        </label>
        <div class="gro-modes" role="group" aria-label="Reply modes">
          <button class="gro-mode" type="button" data-mode="professional" aria-pressed="true">Professional</button>
          <button class="gro-mode" type="button" data-mode="friendly" aria-pressed="false">Friendly</button>
          <button class="gro-mode" type="button" data-mode="direct" aria-pressed="false">Direct</button>
        </div>
        <div class="gro-field" data-role="sliders"></div>
        <div class="gro-actions">
          <button class="gro-button" type="button" data-action="professionalize">Professionalize</button>
          <button class="gro-button gro-button-primary" type="button" data-action="generate">Generate</button>
        </div>
        <div class="gro-output" data-role="output">Generated reply will appear here.</div>
        <div class="gro-actions">
          <button class="gro-button" type="button" data-action="copy">Copy</button>
          <button class="gro-button gro-button-primary" type="button" data-action="insert">Insert in Gmail</button>
        </div>
        <div class="gro-status" data-role="status"></div>
      </div>
    </section>
  `;
  document.documentElement.appendChild(root);

  const state = {
    mode: "professional",
    output: "",
    sliders: {
      professional: 8,
      funny: 2,
      concise: 6,
      warm: 5
    }
  };

  const panel = root.querySelector(".gro-panel");
  const instruction = root.querySelector('[data-role="instruction"]');
  const output = root.querySelector('[data-role="output"]');
  const status = root.querySelector('[data-role="status"]');
  const sliders = root.querySelector('[data-role="sliders"]');

  function renderSliders() {
    sliders.innerHTML = Object.entries(state.sliders)
      .map(([name, value]) => `
        <label class="gro-slider-row">
          <span>${capitalize(name)}</span>
          <input type="range" min="0" max="10" value="${value}" data-slider="${name}" />
          <span data-value="${name}">${value}</span>
        </label>
      `)
      .join("");
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("gro-error", isError);
  }

  function setOutput(text) {
    state.output = text || "";
    output.textContent = state.output || "Generated reply will appear here.";
  }

  function getVisibleText(selector) {
    return Array.from(document.querySelectorAll(selector))
      .filter((node) => node.offsetParent !== null)
      .map((node) => node.innerText || node.textContent || "")
      .map((text) => text.trim())
      .filter(Boolean);
  }

  function readGmailThread() {
    const subject = document.querySelector("h2.hP")?.innerText?.trim() || document.title.replace(" - Gmail", "");
    const messages = getVisibleText(".adn.ads, .a3s.aiL, .ii.gt, [role='listitem']");
    const uniqueMessages = Array.from(new Set(messages))
      .filter((text) => text.length > 20)
      .slice(-8);

    return {
      subject,
      messages: uniqueMessages,
      url: location.href
    };
  }

  function findComposeBox() {
    const boxes = Array.from(document.querySelectorAll("[role='textbox'][g_editable='true'], div[aria-label='Message Body']"))
      .filter((node) => node.offsetParent !== null);
    return boxes[boxes.length - 1] || null;
  }

  function insertIntoGmail(text) {
    const box = findComposeBox();
    if (!box) {
      setStatus("Open a Gmail reply box first, then insert.", true);
      return;
    }

    box.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    box.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    setStatus("Inserted into the active Gmail compose box.");
  }

  async function generateReply(overrideMode) {
    const thread = readGmailThread();
    const userInstruction = instruction.value.trim();

    if (!thread.messages.length) {
      setStatus("I could not read a visible Gmail thread on this page.", true);
      return;
    }

    setStatus("Reading thread and drafting...");
    setOutput("");

    try {
      const response = await fetch(SERVER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread,
          instruction: userInstruction,
          mode: overrideMode || state.mode,
          sliders: state.sliders
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed");
      setOutput(data.reply);
      setStatus(data.mock ? "Drafted with mock mode. Add an API key for LLM output." : "Draft ready.");
    } catch (error) {
      setOutput("");
      setStatus(`Local server error: ${error.message}`, true);
    }
  }

  root.addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target) return;

    if (target.classList.contains("gro-orb")) {
      panel.classList.toggle("gro-hidden");
      return;
    }

    const action = target.dataset.action;
    const mode = target.dataset.mode;

    if (mode) {
      state.mode = mode;
      root.querySelectorAll(".gro-mode").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
      });
      return;
    }

    if (action === "close") panel.classList.add("gro-hidden");
    if (action === "generate") await generateReply();
    if (action === "professionalize") await generateReply("professionalize");
    if (action === "insert") insertIntoGmail(state.output);
    if (action === "copy") {
      await navigator.clipboard.writeText(state.output);
      setStatus("Copied.");
    }
  });

  root.addEventListener("input", (event) => {
    const sliderName = event.target.dataset.slider;
    if (!sliderName) return;
    state.sliders[sliderName] = Number(event.target.value);
    root.querySelector(`[data-value="${sliderName}"]`).textContent = event.target.value;
  });

  renderSliders();
})();


