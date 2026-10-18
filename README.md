# Label Check

A standalone prototype that compares an alcohol label image with the data on its application and checks the government warning word for word. Built for the TTB label compliance take-home.

An agent adds a label image, enters (or imports) what the application says, and gets a verdict in a few seconds: **Matches**, **Needs a person to look**, or **Does not match**, with each item listed side by side.

## Try it

**Deployed Application:** https://label-check-puce.vercel.app — open it to test the working prototype. Reviewers do not need an Anthropic account or API key to test the deployed version. The same frontend is also published on GitHub Pages at https://dbsectrainer.github.io/label-check/, which calls the Vercel API.

The page opens with a generated sample label already loaded. Choose **Check label**, or use the sample picker to load a label with a known problem (title-case warning heading, wrong ABV, reworded warning). The **Batch** tab has an **Add the sample labels** button that runs all five at once.

## Deployment

The project can be deployed two ways:

1. **Full Vercel Deployment (Frontend + Serverless API)**
   - Import the repository into [Vercel](https://vercel.com).
   - Set the Environment Variable: `ANTHROPIC_API_KEY` = `sk-ant-...` (required, or label reading returns 503; optional: `ALLOWED_ORIGIN` for a split deployment, `RATE_LIMIT_PER_MIN`).
   - Vercel automatically serves `index.html` statically and routes `/api/extract` to `api/extract.js`.

2. **Split Deployment (GitHub Pages Frontend + Vercel/Node Backend)**
   - Host `index.html`, `matcher.js`, and `config.js` on GitHub Pages via `.github/workflows/pages.yml`.
   - `config.js` points any `*.github.io` host at the Vercel API (`https://label-check-puce.vercel.app`); change that URL if you host the backend elsewhere.
   - On the backend, set `ALLOWED_ORIGIN` to the Pages origin only, with no path (for example `https://dbsectrainer.github.io`), or the browser blocks the cross-origin call.

## Run it yourself locally

Requires Node 22.9 or newer (developed and tested on Node 26.12.0) and an Anthropic API key. `npm start` uses Node's `--env-file-if-exists` flag, which older versions lack. No npm install is needed; there are no dependencies.

```bash
cp .env.example .env      # then put your key in .env
npm start                 # http://localhost:3000 (loads .env automatically)
npm test                  # 22 matching-rule tests + rate limiter tests
```

Configuration via environment variables:

- `ANTHROPIC_MODEL`: defaults to `claude-haiku-5-5` (Anthropic's fastest model tier for high-volume extraction).
- `ALLOWED_ORIGIN`: unset by default, which means same-origin only (no CORS headers). Set it to the Pages origin (scheme and host, no path) for a split deployment.
- `RATE_LIMIT_PER_MIN`: requests per client per minute to `/api/extract`, default `120` (a 300-label batch fits). Over the limit returns 429 and the page asks the user to wait; a batch pauses at that point and the unchecked rows stay queued so it can be resumed.
- `PORT`: defaults to `3000`.

## How it works

1. **Read.** A vision model transcribes the label into fixed fields (brand, class/type, alcohol content, net contents, bottler, country, warning text) plus two observations: whether the warning heading looks bold and whether the image is readable. The prompt tells it to copy text exactly and never correct it.
2. **Compare.** `matcher.js` decides pass, review or fail for each item. The model never makes that decision, so the same input always gives the same verdict and every rule can be unit tested.
3. **Show.** Results show the application value, the label value and a plain-language reason for each item.

The same page works two ways. Inside Claude it asks Claude directly. Served by `server.js` it posts the image to `/api/extract`, which calls the Messages API with a fixed prompt.

### Matching rules

| Item               | Rule                                                                                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand, class/type  | Identical passes. Differences only in capitalization, punctuation or apostrophe style pass with a note (the `STONE'S THROW` / `Stone's Throw` case). Very close spelling goes to review. Anything else fails.                                                                           |
| Alcohol content    | Compares the number. Accepts `45%`, `45`, or proof only. Flags a label whose proof is not twice its percentage.                                                                                                                                                                         |
| Net contents       | Converts to mL (mL, cL, L, fl oz) and compares within 0.5%, so `750 mL` equals `75 cL`.                                                                                                                                                                                                 |
| Bottler / producer | Every word of the application value must appear on the label. Extra words such as "Bottled by" are ignored.                                                                                                                                                                             |
| Country of origin  | Only checked when the product is marked as imported. Handles "Product of" and common names such as USA.                                                                                                                                                                                 |
| Government warning | Four separate checks: present; heading is exactly `GOVERNMENT WARNING:` in capitals; heading is bold; wording matches 27 CFR 16.21 word for word (case-insensitive for the body, since an all-capitals statement is allowed). A wording failure shows which words are missing or added. |

If the image is rated poor, anything that cannot be read is marked **Check** rather than **Doesn't match**: items missing from the label, a missing warning statement, and warning wording that differs from the required text (the missing words may simply be hidden by glare or a cropped edge). Each carries a note asking for a clearer photo or a look at the label itself. A poor image never excuses a wrong capitalization of the heading, a different brand or a wrong number. If the model cannot tell whether the heading is bold, that is also **Check**.

## How the stakeholder notes shaped it

| Note                                                              | Decision                                                                                                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Results in about 5 seconds or nobody uses it                      | One model call per label, using the fastest model tier. Elapsed time is shown live and in the result. Batch checks run two at a time.              |
| "My mother could figure out"                                      | Two numbered steps, one primary button, large type and targets, plain wording, status shown with an icon and words rather than color alone.        |
| Batch uploads of 200 to 300                                       | Batch tab: many images at once, per-row editable details, CSV import matched by file name, progress, Stop, filters by result, copy results as CSV. |
| Dave: `STONE'S THROW` vs `Stone's Throw`                          | Capitalization-only differences pass with a visible note instead of failing.                                                                       |
| Jenny: warning must be exact, caps and bold                       | Separate checks for each, with a word-level diff.                                                                                                  |
| Jenny: bad angles, glare                                          | The model reads the image as it is and reports quality. Unreadable items go to review instead of reject.                                           |
| Marcus: standalone, no COLA integration, nothing sensitive stored | No database, no accounts, nothing saved. Images are processed in memory.                                                                           |
| Marcus: firewall blocks outbound calls to ML endpoints            | See limitations.                                                                                                                                   |

## What I learned

**Design**

- **The model transcribes; code decides.** The vision model only reads the label. `matcher.js` makes every pass, review or fail call, so the same input always gives the same verdict and each rule has a unit test.
- **Three outcomes, not two.** Near-matches (`STONE'S THROW` vs `Stone's Throw`) and unreadable images need a person's judgment, so "Needs a person to look" sits between match and no match. A poor image never excuses a wrong heading, brand or number.

**Engineering**

- **No dependencies keeps it small, with a cost.** Plain JavaScript and no build step make the project easy to audit, but `npm start` relies on `--env-file-if-exists`, which sets the Node 22.9 minimum.
- **The real rules live in the details.** Unit conversion (`750 mL` equals `75 cL`), the proof-is-twice-ABV check and the word-level warning diff took the most care.
- **Operating limits matter.** Client-side image downscaling avoids oversized payloads, and the rate limiter default is sized so a 300-label batch fits.

**Deployment**

- **A split deployment makes CORS the hard part.** Serving the frontend from GitHub Pages and the API from Vercel needs `ALLOWED_ORIGIN` set to the Pages origin (scheme and host, no path).
- **Keeping the API key server-side forced that architecture** in the first place.

## Tools used

- **Language and runtime:** plain JavaScript (no framework, no build step, no npm dependencies) on Node 22.9 or newer. One page, `index.html`, holds the UI.
- **Label reading:** Anthropic Messages API with a vision-capable model (default `claude-haiku-5-5`, set with `ANTHROPIC_MODEL`), called only from the server so the API key never reaches the browser.
- **Hosting:** Vercel (static frontend plus the `api/extract.js` serverless function) and GitHub Pages (static frontend only).
- **Testing and CI:** Node's built-in `assert` for the unit tests, run by GitHub Actions on every push and pull request.
- **Development aids:** Claude Code was used to help write and review the code and this README.

## Assumptions

- The application fields to compare are brand, class/type, alcohol content, net contents, bottler and (for imports) country of origin. The agent types or imports them; there is no COLA connection.
- The warning text is the standard statement in 27 CFR 16.21. Whether the body of the statement may be in capitals is taken from the public rule; confirm with compliance.
- Sample labels are drawn by the page itself so there is something to test with. They are clean synthetic images, not real photos.

## Limitations and trade-offs

- **Network.** The prototype depends on a hosted model, which Marcus said the agency network would block. A production version would need a model inside the agency's cloud boundary (for example one hosted in their Azure tenant). Only `extract()` in `index.html` and the endpoint in `server.js` would change; the matching code is independent of the model.
- **Speed & Latency.** Images are automatically downscaled client-side to ≤ 1600 px JPEG (~200–400 KB) before sending, preventing API payload rejections and keeping uploads small. Elapsed time is shown for every check so the ~5 second target can be verified; timings depend on the model and network and have not been formally benchmarked.
- **Poor photos.** Skewed, glare-affected or cropped photos are read as well as the model can and anything unreadable goes to review, but accuracy on real-world photos has not been measured: the sample labels are clean synthetic images, and a model that confidently misreads a word on a photo rated "good" would still produce a wording failure.
- **Bold detection is a visual judgment by the model** and can be wrong on small or stylized type. Uncertain cases go to review.
- **Scope.** One label image per application (front label only). No beverage-type specific rules (for example wine appellations or beer exemptions), no check of the label against the full list of mandatory statements, no artwork-position or type-size rules.
- **Image types.** JPG, PNG, WebP and GIF up to 20 MB (large images are downscaled automatically in the browser). iPhone HEIC photos must be shared as JPEG first.
- **Not an approval.** The tool supports the agent's review; it does not replace judgment.

## Next steps

- Test with real, imperfect photos (angles, glare, crops) and benchmark the 5-second target.
- Host the model inside the agency's cloud boundary so the network does not block it.
- Add beverage-type specific rules (wine, beer, distilled spirits).

## Files

- `index.html` main application page (UI logic, image downscaling, canvas sample generator)
- `matcher.js` pure matching rules and extraction prompt (browser and Node)
- `matcher.test.js` unit test suite (22 tests)
- `ratelimit.js` / `ratelimit.test.js` per-client rate limiter used by both API entry points
- `server.js` zero-dependency local Node server with `/api/extract` and CORS
- `api/extract.js` Vercel serverless function for production API deployment
- `config.js` environment configuration for GitHub Pages frontend
- `.github/workflows/ci.yml` runs `npm test` on pushes and pull requests
- `.github/workflows/pages.yml` GitHub Actions automated workflow for Pages
- `vercel.json` / `.vercelignore` Vercel configuration; `.vercelignore` keeps the local-only `server.js` out of the deployment
- `.env.example` template for the environment variables
