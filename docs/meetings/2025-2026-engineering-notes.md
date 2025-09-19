# Engineering notes

Recorded by Ajay.

The product is two programs on one Postgres database:

- The Next.js console runs campaigns: upload buildings, keep a decision-maker, send a template, log the reply, store a proposal PDF.
- The FastAPI service runs valuations: a tenant, priced listings, leads, a model, and drafts that quote the model.

They must not share a `properties` table. The columns are not the same.

---

## 16 Jul 2025: what a "property" is

The upload path inserts `property_address`, city, county, state, zip, and a decision maker. The valuation model needs sqft, beds, baths, year built, condition, and `list_price`. Forcing one row to carry both means every campaign import has to invent a price, and every listing has to invent a decision maker.

Decision: `public.properties` is the campaign target. `valuation.properties` is the listing. Opt-out lives only on the campaign row (`opt_out_code`). Tenant ownership lives only on the listing.

Also decided: address dedupe is a unique index on `property_address`, not a check-then-insert in the route. Two overlapping upload batches will otherwise both pass the `.in()` lookup and insert the same building.

Open: county is free text. No geography table until we have a real county list worth maintaining.

---

## 8 Aug 2025: tenants, agents, leads

Signup creates one tenant and one admin. A second user in that tenant is an agent, created by the admin. Agents can create and edit listings and leads. Agents cannot delete, and they cannot read `/audit`.

Lead budgets are a constraint, not a comment: `budget_min <= budget_max` or the insert fails. The recommender treats type, city, and "way over budget" as hard filters. Price inside a 10% stretch past `budget_max` is a soft penalty, not a drop.

Cross-tenant reads return 404, including when the id is real and belongs to someone else. 403 would confirm the row exists.

---

## 19 Sep 2025: estimates and what we will say in a draft

The model returns a point and an 80% residual interval. A listing is undervalued, fair, or overpriced by comparing list price to that estimate. Opportunities are the undervalued active listings, sorted by discount.

Drafts are templates first. An optional LLM pass may rephrase them. If the dollar figures or the opt-out footer change, the polish is thrown away and the template is what gets stored. `mark-sent` flips status. It does not call an email provider. Delivery stays outside this service until there is a place to honor STOP replies.

The number in the draft has to be the number the model produced. We will not let a rewrite "round" a price.

---

