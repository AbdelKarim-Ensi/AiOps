# Task Manager API — Phase 1 (Plateforme AIOps)

API NestJS + Prisma + PostgreSQL générant des logs structurés JSON.
Base de la Phase 1 du projet AIOps de détection d'anomalies dans les logs.

## Prérequis

- Node.js 18+
- PostgreSQL déjà installé et lancé localement

## Installation

```powershell
npm install
```

## Configuration

Modifie le fichier `.env` avec tes propres identifiants PostgreSQL :

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:PORT/taskmanager?schema=public"
```

Remplace `USER`, `PASSWORD` et `PORT` par tes vrais identifiants.
Si la base `taskmanager` n'existe pas encore, crée-la d'abord (via pgAdmin ou `psql`).

## Générer le client Prisma et appliquer le schéma

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

`migrate dev` crée les tables `User` et `Task` dans ta base PostgreSQL,
à partir du schéma défini dans `prisma/schema.prisma`.

## Lancer l'API

```powershell
npm run start:dev
```

L'API démarre sur `http://localhost:3000`.

## Endpoints disponibles

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Vérification de santé (sans DB) |
| POST | `/tasks` | Créer une tâche |
| GET | `/tasks` | Lister toutes les tâches |
| GET | `/tasks/:id` | Récupérer une tâche par id |
| PATCH | `/tasks/:id` | Mettre à jour une tâche |
| DELETE | `/tasks/:id` | Supprimer une tâche |
| GET | `/tasks/simulate-failure` | Simule un succès/échec aléatoire (génère des logs error) |

## Exemple de requête (création d'une tâche)

```powershell
curl -X POST http://localhost:3000/tasks `
  -H "Content-Type: application/json" `
  -d '{"title": "Terminer la Phase 1", "priority": "HIGH"}'
```

## Logs

Les logs sont structurés en JSON (via `nestjs-pino`), avec les champs
`timestamp`, `level`, `message`, `context`. En développement, ils sont
affichés en couleur grâce à `pino-pretty`. En production (Kubernetes,
Phase 5+), ils sont émis en JSON brut pour être collectés par Grafana Alloy.

## Prochaine étape

Phase 2 — Dockerisation (Dockerfile multi-stage + docker-compose).
