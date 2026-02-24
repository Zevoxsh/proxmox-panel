# ProxPanel

Panel d'hébergement VPS pour Proxmox (LXC & KVM) avec facturation Stripe.

## Stack

- **Frontend**: Next.js 15 App Router + shadcn/ui + Tailwind CSS
- **Backend**: Express.js + PostgreSQL 16 (SQL)
- **Auth**: JWT + bcrypt
- **Proxmox**: API REST native (pas de dépendance externe)
- **Paiements**: Stripe (abonnements + webhooks)
- **Cache**: Redis 7
- **Reverse proxy**: Nginx
- **Déploiement**: Docker Compose

## Démarrage rapide (développement)

### 1. Copier les variables d'environnement

```bash
cp .env.example .env
# Éditez .env avec vos valeurs
```

### 2. Démarrer les services

```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

La base est initialisée automatiquement via `server/db/init.sql` + `server/db/seed.sql`.
Si vous avez déjà un volume Postgres, supprimez-le pour réappliquer le schéma.

L'application est disponible sur `http://localhost:3000`

**Comptes par défaut** (après seed):
- Admin: `admin@panel.local` / `admin123!`
- Client: `demo@panel.local` / `user123!`

## Déploiement production

```bash
# 1. Configurer .env avec vos vraies clés
# 2. Build + démarrer
docker-compose up -d --build
```

## Configuration Proxmox

Dans le panel admin → **Nodes**, ajoutez votre serveur Proxmox:
- Host: IP de votre Proxmox
- Port: 8006 (défaut)
- Username: `root`
- Realm: `pam`
- Mot de passe: votre mot de passe root

## Configuration Stripe

1. Créez vos produits dans le [dashboard Stripe](https://dashboard.stripe.com/products)
2. Mettez à jour `stripePriceId` dans la table `vm_plans`
4. Configurez le webhook sur `https://votredomaine.com/stripe/webhook`

**Événements webhook requis:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## Structure du projet

```
proxmox-panel/
├── app/                    # Application Next.js
│   ├── src/
│   │   ├── app/            # Pages (App Router)
│   │   │   ├── (auth)/     # Login, Register
│   │   │   ├── (client)/   # Dashboard, VMs, Billing
│   │   │   ├── admin/      # Panel admin
│   │   │   └── api/        # API routes
│   │   ├── components/     # Composants React
│   │   │   ├── ui/         # shadcn/ui
│   │   │   ├── layout/     # Sidebar, Navbar
│   │   │   ├── vms/        # Composants VM
│   │   │   ├── billing/    # Composants facturation
│   │   │   └── admin/      # Composants admin
│   │   └── lib/            # Utilitaires
│   │       ├── proxmox.ts  # Client API Proxmox
│   │       ├── stripe.ts   # Client Stripe
│   │       └── auth.ts     # Auth backend
│   └── Dockerfile
├── server/                 # Backend Express
│   ├── db/                 # SQL init + seed
│   ├── src/                # API + auth
│   └── Dockerfile
├── nginx/nginx.conf        # Reverse proxy
├── docker-compose.yml      # Production
└── docker-compose.dev.yml  # Développement
```

## Fonctionnalités

### Client
- **Dashboard**: Vue d'ensemble, VMs récentes, statut abonnement
- **VMs**: Liste, création (LXC/KVM), détail avec métriques temps réel
  - Start / Stop
  - CPU, RAM, disque en temps réel (polling 10s)
  - Suppression avec confirmation
- **Billing**: Abonnements Stripe, historique factures, portail client

### Admin
- **Vue globale**: Stats (users, VMs, revenus)
- **Utilisateurs**: Liste complète avec infos Stripe
- **Nodes**: Gestion des nœuds Proxmox (ajout avec test de connexion)
- **VMs**: Toutes les VMs de tous les clients
