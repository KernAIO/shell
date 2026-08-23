# Glossary

One English term, one translation, everywhere. Terminology drift is the quality defect a complete
catalogue still has: `tracker_issues_count` and `tracker_planning_issue_count` are the same English
string, "{count} issues", and were once rendered «{count} کار» and «{count} مورد».

Add a row when you settle a product noun. Check here before inventing one.

## Product nouns

| English | فارسی | العربية | Deutsch | Note |
|---|---|---|---|---|
| issue | کار | مهمة | Vorgang | what a team tracks; the everyday word |
| work item type | نوع مورد | نوع العنصر | Vorgangstyp | the configurable kind — «مورد» is the item, «کار» the work |
| workspace | فضای کاری | مساحة العمل | Workspace | |
| project | پروژه | مشروع | Projekt | |
| workflow | گردش کار | سير العمل | Workflow | |
| status | وضعیت | حالة | Status | |
| transition | جابه‌جایی | انتقال | Übergang | a move between statuses |
| cycle | چرخه | دورة | Zyklus | a sprint, whatever a team calls it |
| milestone | نقطه عطف | معلم | Meilenstein | |
| backlog | بک‌لاگ | قائمة الانتظار | Backlog | |
| triage | بررسی اولیه | فرز | Triage | |
| label | برچسب | تسمية | Label | |
| field | فیلد | حقل | Feld | a custom field |
| view | نما | عرض | Ansicht | a saved query |
| board | تخته | لوحة | Board | |
| channel | کانال | قناة | Kanal | |
| plan | طرح | خطة | Tarif | billing |
| seat | کاربر | مستخدم | Nutzer | never «صندلی» — it is a person, not furniture |

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
