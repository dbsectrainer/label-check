# Label Check

A standalone prototype that compares an alcohol label image with the data on its application and checks the government warning word for word. Built for the TTB label compliance take-home.

An agent adds a label image, enters (or imports) what the application says, and gets a verdict in a few seconds: **Matches**, **Needs a person to look**, or **Does not match**, with each item listed side by side.

## Try it

**Deployed Application:** Open the published URL to test the working prototype. Reviewers do not need an Anthropic account or API key to test the deployed version.

The page opens with a generated sample label already loaded. Choose **Check label**, or use the sample picker to load a label with a known problem (title-case warning heading, wrong ABV, reworded warning). The **Batch** tab has an **Add the sample labels** button that runs all five at once.

## Deployment

The project can be deployed two ways:

1. **Full Vercel Deployment (Frontend + Serverless API)**
   - Import the repository into [Vercel](https://vercel.com).
   - Set the Environment Variable: `ANTHROPIC_API_KEY` = `sk-ant-...` (required, or label reading returns 503; optional: `ALLOWED_ORIGIN` for a split deployment, `RATE_LIMIT_PER_MIN`).
   - Vercel automatically serves `index.html` statically and routes `/api/extract` to `api/extract.js`.

2. **Split Deployment (GitHub Pages Frontend + Vercel/Node Backend)**
   - Host `index.html`, `matcher.js`, and `config.js` on GitHub Pages via `.github/workflows/pages.yml`.
   - In `config.js`, set `window.LABEL_CHECK_API = "https://your-backend.vercel.app"` pointing to your hosted API.

## Run it yourself locally

Requires Node 18 or newer (developed and tested on Node 26.12.0) and an Anthropic API key. No npm install is needed; there are no dependencies.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node server.js            # http://localhost:3000
npm test                  # 21 matching-rule tests + rate limiter tests
```

Configuration via environment variables:

- `ANTHROPIC_MODEL`: defaults to `claude-haiku-5-5` (Anthropic's fastest model tier for high-volume extraction).
- `ALLOWED_ORIGIN`: unset by default, which means same-origin only (no CORS headers). Set it to your Pages URL for a split deployment.
- `RATE_LIMIT_PER_MIN`: requests per client per minute to `/api/extract`, default `120` (a 300-label batch fits). Over the limit returns 429 and the page asks the user to wait.
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

If the image is rated poor and something cannot be read, that item is marked **Check** rather than **Doesn't match**, with a note asking for a clearer photo. If the model cannot tell whether the heading is bold, that is also **Check**.

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

## Assumptions

- The application fields to compare are brand, class/type, alcohol content, net contents, bottler and (for imports) country of origin. The agent types or imports them; there is no COLA connection.
- The warning text is the standard statement in 27 CFR 16.21. Whether the body of the statement may be in capitals is taken from the public rule; confirm with compliance.
- Sample labels are drawn by the page itself so there is something to test with. They are clean synthetic images, not real photos.

## Limitations and trade-offs

- **Network.** The prototype depends on a hosted model, which Marcus said the agency network would block. A production version would need a model inside the agency's cloud boundary (for example one hosted in their Azure tenant). Only `extract()` in `index.html` and the endpoint in `server.js` would change; the matching code is independent of the model.
- **Speed & Latency.** Images are automatically downscaled client-side to ≤ 1600 px JPEG (~200–400 KB) before sending, preventing API payload rejections and keeping end-to-end latency within ~1.5–3 seconds per label.
- **Bold detection is a visual judgment by the model** and can be wrong on small or stylized type. Uncertain cases go to review.
- **Scope.** One label image per application (front label only). No beverage-type specific rules (for example wine appellations or beer exemptions), no check of the label against the full list of mandatory statements, no artwork-position or type-size rules.
- **Image types.** JPG, PNG, WebP and GIF up to 20 MB (large images are downscaled automatically in the browser). iPhone HEIC photos must be shared as JPEG first.
- **Not an approval.** The tool supports the agent's review; it does not replace judgment.

## Files

- `index.html` main application page (UI logic, image downscaling, canvas sample generator)
- `matcher.js` pure matching rules and extraction prompt (browser and Node)
- `matcher.test.js` unit test suite (21 tests)
- `ratelimit.js` / `ratelimit.test.js` per-client rate limiter used by both API entry points
- `server.js` zero-dependency local Node server with `/api/extract` and CORS
- `api/extract.js` Vercel serverless function for production API deployment
- `config.js` environment configuration for GitHub Pages frontend
- `.github/workflows/ci.yml` runs `npm test` on pushes and pull requests
- `.github/workflows/pages.yml` GitHub Actions automated workflow for Pages
- `vercel.json` Vercel deployment configuration
