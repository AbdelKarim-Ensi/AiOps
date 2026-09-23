# Phase 1 — Backend NestJS + Prisma + PostgreSQL

**Statut :** ✅ Terminée
**Période :** 31 août 2026 (commit `32ecdc8`)

## 1. Objectif

Disposer d'une API applicative réelle, qui servira de source de logs et de métriques pour toutes les phases suivantes (observabilité, ML, alerting).

**Definition of Done (PRD) :**
> API tourne en local, génère des logs JSON structurés contenant timestamp, level, message, context.

## 2. Livrables

- API REST **NestJS** dans `apps/backend`, avec un CRUD complet pour l'entité du domaine « taskmanager ».
- Accès aux données via **Prisma** (ORM) sur **PostgreSQL** ; la base s'appelle `taskmanager`.
- Configuration de la connexion par la variable d'environnement `DATABASE_URL`.
- Logger structuré JSON (`timestamp`, `level`, `message`, `context`), demandé par la DoD du PRD.

## 3. Évolutions ultérieures du backend

| Phase | Ajout |
|---|---|
| 1 / 6 | Logs JSON structurés sur `stdout` (`nestjs-pino`), prévus dès la phase 1 par le PRD et exploités par Alloy et Loki en phase 6 |
| 8 | Module `Anomalies` (CRUD + faux positif), migration Prisma, contrainte d'unicité sur `windowStart` |
| 9 | Endpoint `/metrics` (compteur et histogramme HTTP Prometheus) |
| 10 | Filtres, pagination, statistiques et détail des anomalies |

## 4. Leçon retenue

Le projet a d'abord été développé sous Windows puis poursuivi sous Linux : les fins de ligne (CRLF → LF) et le `package-lock.json` ont dû être normalisés (voir phase 3).