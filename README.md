
https://github.com/user-attachments/assets/1682024b-031b-4951-b4cf-0032f45e70ac
# InvestHub

![Frontend](https://img.shields.io/badge/Frontend-Angular-red)
![Backend](https://img.shields.io/badge/Backend-Node.js-green)
![Database](https://img.shields.io/badge/Database-MySQL-blue)
![ORM](https://img.shields.io/badge/ORM-Prisma-black)
![Architecture](https://img.shields.io/badge/Architecture-Modular-success)
![Auth](https://img.shields.io/badge/Auth-JWT-orange)
![Status](https://img.shields.io/badge/status-MVP-yellow)

InvestHub is a full-stack investment tracking platform developed as an MVP.   
 

---

## Core Features

- JWT authentication (Register / Login)
- Real-time portfolio base currency conversion (live FX rates)
- Multiple portfolios (Crypto, Metals, ETFs)
- Real-time crypto market prices
- Detailed asset view
- Real-time asset price chart
- Portfolio allocation distribution chart
- Activity logs (portfolio history tracking)
- Add assets to portfolios
- Asset filtering and organization system

---

## Architecture

### High-level

flowchart LR
A[Angular Frontend] --> B[REST API - Node.js / Express]
B --> C[Prisma ORM]
C --> D[(MySQL Database)]
B --> E[Auth Middleware - JWT]
B --> F[FX Service]
B --> G[Crypto Price Service - CoinGecko]


Backend Architecture

The backend follows a modular architecture with clear separation of concerns:

src/
 ├── config
 ├── db
 ├── middleware
 │    ├── authRequired.js
 │    └── errorHandler.js
 ├── modules
 │    ├── auth
 │    ├── users
 │    ├── portfolios
 │    ├── positions
 │    ├── crypto
 │    ├── prices
 │    └── dashboard
 ├── services
 │    └── prices
 └── lib

Each module contains:

routes → API endpoints

controller → HTTP layer

service → business logic

repo → database access (Prisma)


Authentication

Authentication is implemented using JWT tokens and enforced through middleware:

Token issued at login/register

Protected routes use authRequired middleware

User identity injected into request context


Real-Time Data
Crypto Prices

Live crypto prices fetched via external provider (CoinGecko)

Cached to avoid rate limits

Market values calculated dynamically per asset

FX Conversion

Daily FX rates fetched and cached

Portfolio values converted to user display currency

Conversion applied recursively to financial data


Dashboard Engine (Core Logic)

The dashboard computes portfolio summaries including:

Totals per portfolio

Totals per asset type

Totals per asset

Market vs manual valuation

Real-time crypto market valuation

Market distribution is calculated dynamically from position quantities and live prices.


Data Model (Conceptual)

Main entities:

User

Portfolio (hierarchical)

PortfolioPosition

Asset

Logs / Movements

FX Rates (cached)

Price Cache

Portfolios support tree structure (parent → children) enabling aggregated summaries across nested portfolios.

https://github.com/user-attachments/assets/9de7a553-d0d0-405e-931c-69739a98e2c1

