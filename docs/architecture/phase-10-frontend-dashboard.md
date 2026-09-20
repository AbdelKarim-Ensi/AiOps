# Phase 10 : Frontend Angular (dashboard des anomalies)

Branche : `phase-10-frontend-dashboard`

## Objectif

Donner une interface web à la détection d'anomalies : afficher les statistiques, lister les fenêtres de logs détectées comme anormales, consulter le détail d'une anomalie et la marquer comme faux positif. Le frontend est conteneurisé, déployé sur le cluster kind à côté de l'API, et construit par une pipeline CI dédiée.

## Sous-tâches et commits

| Sous-tâche | Contenu | Commit |
|---|---|---|
| 10.1 | Backend : filtres, pagination, stats, détail | `10a5d95` |
| 10.2 | Scaffold Angular et proxy `/api` | `4f1ee7e` |
| 10.3 | Modèles et service HTTP des anomalies | `36ff2b3` |
| 10.4 | Dashboard : design, icônes Lucide, mode sombre, badges | `a5b1b82` |
| 10.5 | Vue liste des anomalies | `b9072a3` |
| 10.6 | Vue détail d'une anomalie | `a4b5934` |
| 10.7 | Dockerfile multi-stage et nginx | `aa81967` |
| 10.8 | Manifests K8s et Ingress (`/api` et `/`) | `fcceefd` |
| 10.9 | Pipeline `frontend-ci.yml`, correction de `app.spec.ts` | `171662e` |
| 10.10 | Cette documentation | |

## Architecture

```
Navigateur
   │
   ▼
Ingress nginx (localhost:80)
   ├── /api/...  ──(réécriture : /api retiré)──▶ api-service:3000   (NestJS)
   └── /         ─────────────────────────────▶ frontend-service:80 (nginx + Angular)
```

En développement, `ng serve` joue le rôle de l'Ingress : `proxy.conf.json` envoie `/api` vers `http://localhost:3000` en retirant le préfixe `/api`. En cluster, c'est l'Ingress qui fait cette réécriture. Le code Angular appelle toujours `/api/anomalies` et ne change pas d'un environnement à l'autre.

## Backend (10.1)

L'API expose pour les anomalies : une liste filtrable et paginée (période, statut faux positif), des statistiques pour le dashboard, le détail par identifiant (400 si l'id n'est pas un UUID, 404 s'il n'existe pas) et le marquage en faux positif (`PATCH /anomalies/:id/false-positive`). Le détail des paramètres se trouve dans le contrôleur et dans `apps/frontend/src/app/core/anomalies.service.ts`.

`errorRate` est un ratio entre 0 et 1 (0,33 pour 40 erreurs sur 120 logs).

## Frontend (10.2 à 10.6)

- **Angular** avec composants standalone, signals et chargement paresseux des routes.
- **Tailwind CSS** pour le style (`src/tailwind.css`, `.postcssrc.json`), icônes **Lucide**, mode sombre suivant la préférence du système.
- **Routes** : `/dashboard`, `/anomalies`, `/anomalies/:id`. Toute autre route redirige vers `/dashboard`.
- **Couche HTTP** : `core/anomaly.models.ts` (types) et `core/anomalies.service.ts` (`baseUrl = '/api/anomalies'`).
- **Liste** : tableau paginé, filtres Du / Au / Faux positif, bouton « Marquer faux positif » qui met à jour la ligne sans recharger la page, lignes cliquables vers le détail.
- **Détail** : les 9 champs de l'anomalie et le bouton de marquage. Quatre états d'erreur distincts : chargement, identifiant invalide (400), anomalie introuvable (404), API injoignable ou erreur 5xx.
- **Affichage du taux d'erreur** : en décimal dans la liste, avec son équivalent en pourcentage dans le détail.

## Conteneurisation (10.7)

`apps/frontend/Dockerfile` en deux étapes :

1. `node:22-alpine` : `npm ci` puis `npm run build` (sortie dans `dist/frontend/browser`).
2. `nginx:1.27-alpine` : copie du build et de `nginx.conf`.

`nginx.conf` :

- `/healthz` renvoie `200 ok` (utilisé par les probes Kubernetes) ;
- fichiers `.js`, `.css` et polices : cache long (`immutable`) ;
- toute autre route renvoie `index.html` avec `Cache-Control: no-cache` (fallback SPA, nécessaire pour recharger `/anomalies/:id`) ;
- compression gzip.

`.dockerignore` exclut `node_modules`, `dist`, `.angular` et les fichiers d'environnement de développement.

## Déploiement Kubernetes (10.8)

Fichiers dans `infra/k8s/base/` :

- `frontend/deployment.yaml` : 1 réplica, image `ghcr.io/abdelkarim-ensi/aiops-frontend:latest`, probes sur `/healthz`, requêtes de 10m CPU et 16Mi, limite mémoire de 64Mi.
- `frontend/service.yaml` : `frontend-service` (ClusterIP, port 80).
- `ingress/ingress.yaml` : `/` vers `frontend-service:80`.
- `ingress/api-ingress.yaml` : `/api(/|$)(.*)` vers `api-service:3000`, avec `rewrite-target: /$2`.

**Pourquoi deux Ingress ?** L'annotation `rewrite-target` s'applique à tout l'objet Ingress. Sur un objet unique, elle réécrirait aussi les routes du frontend. Deux objets sur le même host (`localhost`) sont fusionnés par ingress-nginx.

**Conséquence** : l'API n'est plus joignable sur `localhost/xxx` mais sur `localhost/api/xxx`. Le contrôle de santé de l'API est donc `localhost/api/health`. `localhost/health` renvoie désormais la page du frontend (fallback SPA) et ne prouve rien sur l'API.

Les manifests sont appliqués à la main (`kubectl apply -f infra/k8s/base/frontend/` puis `.../ingress/`), comme ceux du backend. La CI ne fait que changer l'image du Deployment.

## Pipeline CI/CD (10.9)

`.github/workflows/frontend-ci.yml`, sur le modèle de `backend-ci.yml` :

| Job | Déclencheur | Rôle |
|---|---|---|
| `build-test` | push sur `main` et pull request (chemins `apps/frontend/**`) | Node 22, `npm ci`, `npm run build`, `npm test -- --no-watch` |
| `docker-build-push` | push sur `main` uniquement | Construit l'image et la pousse sur ghcr (`:latest` et `:<sha>`) |
| `deploy` | après le push de l'image, runner self-hosted | `kubectl set image deployment/frontend ...` puis `rollout status` |

Il n'y a pas d'étape lint : `package.json` ne définit que `build` et `test`.

`app.spec.ts` a été corrigé : l'ancien test cherchait le `h1` « Hello, frontend » du scaffold. Les deux tests vérifient maintenant la création de l'application et la présence de la barre de navigation (AiOps, Dashboard, Anomalies). Ce sont pour l'instant les seuls tests du frontend.

## Difficultés rencontrées

- **Build Docker bloqué** : `npm run build` a tourné plus de 10 minutes dans le conteneur alors qu'il prend quelques secondes en local. La cause était un manque de mémoire dans la VM de Docker Desktop (3,65 Go), partagée avec le cluster kind, et occupée en plus par le Kubernetes intégré de Docker Desktop (un second cluster vide). Après avoir désactivé ce Kubernetes intégré, le build a pris 2 min 26 s.
- **Image locale dans kind** : le cluster ne voit pas les images du Docker local. L'image a été chargée avec `kind load docker-image` sous le nom `ghcr.io/abdelkarim-ensi/aiops-frontend:latest`, et le Deployment utilise `imagePullPolicy: IfNotPresent`. Avec `:latest` sans cette règle, Kubernetes tenterait un pull depuis ghcr.
- **Fichiers corrompus au collage** : des blocs HTML collés dans le terminal ont perdu des caractères. Les empreintes (`sha256sum`) et les nombres de lignes servaient à détecter le problème.

## Limites connues

- **Dashboard non testé de bout en bout dans le cluster avant la fusion.** L'API en place dans le cluster utilisait encore l'image d'avant la 10.1 (`/api/anomalies/stats` renvoyait 404, et la liste un simple tableau). La validation complète dépend de la nouvelle image du backend, construite par `backend-ci.yml` après la fusion. Avant la fusion, l'Ingress a été vérifié par `/api/health`, `/api/anomalies` et le fallback SPA sur `/anomalies/abc`.
- **Images ghcr** : le Deployment référence une image qui n'existe sur ghcr qu'après le premier push de la CI. Si le pod passe en `ImagePullBackOff`, il faut vérifier que le package `aiops-frontend` est accessible au cluster (visibilité du package).
- **Une seule réplique et aucun test d'intégration** : le frontend n'a pas de tests de composants, seulement les deux tests de `app.spec.ts`.

## Vérification après fusion

```bash
kubectl -n aiops get pods
kubectl -n aiops rollout status deployment/api
kubectl -n aiops rollout status deployment/frontend
curl -s localhost/api/health
curl -s localhost/api/anomalies/stats
curl -s -o /dev/null -w "%{http_code}\n" localhost/anomalies/abc
```

Attendu : pods `Running`, `{"status":"ok",...}`, du JSON de statistiques, puis `200`. Ouvrir ensuite `http://localhost/` : le dashboard, la liste et le détail doivent afficher les données de l'API, y compris après un rechargement (F5) sur `/anomalies/<id>`.