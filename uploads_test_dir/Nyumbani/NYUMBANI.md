**A digital home for African makers.** USSD storefront, M-Pesa order desk and smart inventory — built for _jua kali_ producers who need to sell online without needing a website, an app, or even a smartphone.

Built for the **Africa's Talking Open Hackathon: Manufacturing** (Nairobi, Aug 2026).

---

## What it does

[](https://github.com/Gabrielalchemy/Nyumbani#what-it-does)

| Channel                 | Capability                                                                                                                                                                 |     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **USSD** (`*384*XXXX#`) | Customers browse the catalogue, order and pay an M-Pesa deposit from any phone                                                                                             |     |
| **Web storefront**      | Beautiful animated catalogue; "pay deposit" triggers a live M-Pesa STK push                                                                                                |     |
| **Owner dashboard**     | SMS-OTP login · products & stock · order board with automatic customer SMS updates · restock tracking                                                                      |     |
| **AI insights**         | Upload invoices/receipts → Gemini extracts structured data → one-tap business report (revenue, expenses by supplier/category, stock health) → readable on screen or as SMS |     |

Every sale decrements stock atomically; crossing a product's alert threshold texts the owner automatically.



[[Phase 1-Core Architecture & Database Schema]]
[[Phase 2-Telephony Integrations — USSD & M-Pesa]]
[[Phase 3-AI Business Insights & Expense Tracking]]
[[Phase 4-Storefront & Admin Dashboard UX]]
[[Phase 5-Production Cloud Deployment & Containerization]]
[[Phase 6-Africa's Talking Marketplace & Scale]]
