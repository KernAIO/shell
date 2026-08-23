# Glossary

One English term, one translation, everywhere. Terminology drift is the quality defect a complete
catalogue still has: `tracker_issues_count` and `tracker_planning_issue_count` are the same English
string, "{count} issues", and were once rendered «{count} کار» and «{count} مورد».

Add a row when you settle a product noun. Check here before inventing one.

The same pass found German rendering "work item" as «Vorgang» everywhere except two dashboard
widgets, which said «Aufgaben» — one noun, two words, in the screens most likely to be read side by
side. A glossary row is what stops the second word being invented.

## Product nouns

| English | فارسی | العربية | Deutsch | Türkçe | Note |
|---|---|---|---|---|---|
| issue | کار | مهمة | Vorgang | İş | what a team tracks; the everyday word |
| work item type | نوع مورد | نوع العنصر | Vorgangstyp | İş türü | the configurable kind — «مورد» is the item, «کار» the work |
| workspace | فضای کاری | مساحة العمل | Workspace | Çalışma alanı | German keeps the English word |
| project | پروژه | مشروع | Projekt | Proje | |
| workflow | گردش کار | سير العمل | Workflow | İş akışı | |
| status | وضعیت | حالة | Status | Durum | |
| transition | جابه‌جایی | انتقال | Übergang | Geçiş | a move between statuses |
| cycle | چرخه | دورة | Zyklus | Döngü | a sprint, whatever a team calls it |
| milestone | نقطه عطف | معلم | Meilenstein | Kilometre taşı | |
| backlog | بک‌لاگ | قائمة الانتظار | Backlog | Backlog | |
| triage | بررسی اولیه | فرز | Triage | Triyaj | |
| label | برچسب | تسمية | Label | Etiket | |
| field | فیلد | حقل | Feld | Alan | a custom field |
| view | نما | عرض | Ansicht | Görünüm | a saved query |
| board | تخته | لوحة | Board | Pano | |
| channel | کانال | قناة | Kanal | Kanal | |
| plan | طرح | خطة | Tarif | Tarife | billing |
| seat | کاربر | مستخدم | Nutzer | Kullanıcı | never «صندلی» — it is a person, not furniture |

## Spelling and orthography

- **جست‌وجو**, not جستجو. The ZWNJ form is standard modern Persian.
- ZWNJ (U+200C) in compounds: می‌شود, فضای کاری, به‌روزرسانی.
- Persian quotation marks are «…», not “…”.
- The brand is transliterated: **کرن**, consistently. Product names are not — Mailgun, Postmark,
  SMTP, Stripe stay in Latin script.

## What is not translated

Brand and protocol names, literals a user types verbatim, and identifiers: `KERN-1`, `cf.<key>`,
KQL fragments, `install.sh`, `.env`, API. `scripts/check-i18n.mjs` keeps an allow-list of the keys
whose value is legitimately identical to English.
