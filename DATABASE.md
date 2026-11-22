# Base de données DeltaLab (`data/deltalab.sqlite`)

Ce document décrit l’architecture, les sources scientifiques, les scripts de génération et les règles de validation qui alimentent la base SQLite embarquée de DeltaLab.

---

## 1. Vue d’ensemble & fonctionnement

- **Moteur** : SQLite local via `node:sqlite` (`DatabaseSync`), stocké dans `data/deltalab.sqlite` (schéma défini dans `server/schema.sql`).
- **Auto-seeding versionné** : au démarrage du serveur Hono (`server/db/seed.ts`), une signature `seed_version` est calculée à partir du numéro de version du seed, du nombre d’entrées curatées et de la taille / date de modification (`size:mtimeMs`) des fichiers générés dans `server/data/generated/`. Dès qu’un script de pipeline régénère un JSON, la base SQLite se met automatiquement à jour dans une transaction atomique (`BEGIN TRANSACTION` … `COMMIT`).
- **Politique d’honnêteté des données** : toute propriété expérimentale absente ou contradictoire reste à `null` en base et s’affiche explicitement comme `?` dans l’interface — aucune valeur par défaut artificielle (fausse densité, faux point d’ébullition, fausse couleur) n’est inventée.

---

## 2. Pipeline de remplissage (4 étapes + seed)

Les scripts se trouvent dans `scripts/db/` et reposent sur un cache disque persistant dans `scripts/db/.cache/` (`scripts/db/lib/cache.ts`) afin de limiter la charge sur les API publiques et permettre des régénérations rapides et déterministes.

### Commandes pour tout régénérer

```bash
# Étape 1 : Collecte de la liste des espèces candidates (Curatées + Wikipédia FR / Wikidata)
node --experimental-strip-types scripts/db/1-collect-species.ts

# Étape 2 : Enrichissement scientifique (PubChem + AqSolDB + IUPAC) & filtrage strict
node --experimental-strip-types scripts/db/2-enrich-species.ts

# Étape 3 : Tables de constantes pour le moteur de réactions (E°, pKs, pKa)
node --experimental-strip-types scripts/db/3-import-reactions.ts

# Étape 4 : Base vérifiée des alliages métallurgiques (100 % FR)
node --experimental-strip-types scripts/db/4-import-alloys.ts
```

Au lancement suivant du serveur (`pnpm dev` ou `pnpm dev:server`), `server/db/seed.ts` détecte la mise à jour des fichiers `server/data/generated/*.json` et ré-alimente `data/deltalab.sqlite`.

---

## 3. Détail des étapes & données récupérées

### Étape 1 — Collecte des espèces candidates (`scripts/db/1-collect-species.ts`)
- **Entrées** :
  - Noyau curaté du laboratoire (`server/data/species/curated/*` — **236 espèces**).
  - Toutes les pages de **Wikipédia FR** utilisant `Modèle:Infobox Chimie` (**7 792 pages** récupérées via l’API MediaWiki `generator=embeddedin`).
  - Métadonnées croisées **Wikidata** (`wbgetentities` par lots de 50 QID) : label FR/EN, numéro CAS (`P231`), PubChem CID (`P662`), InChIKey (`P235`), SMILES (`P233` / `P2017`) et notoriété (nombre de *sitelinks*).
- **Filtrage** : exclusion des articles génériques (listes, familles, mélanges, polymères) et des entrées sans aucun identifiant chimique (`CID`, `InChIKey`, `CAS` ou `SMILES`).
- **Sortie** : `server/data/generated/species-candidates.json` (**7 456 candidats** : 236 curatées + 7 220 Wikipédia FR triées par notoriété).

### Étape 2 — Enrichissement physico-chimique & filtrage strict (`scripts/db/2-enrich-species.ts`)
- **Sources interrogées** :
  1. **PubChem Bulk Experimental Annotations (NIH)** : téléchargement paginé des jeux d’annotations expérimentales (`Density`, `Melting Point`, `Boiling Point`, `Color/Form`, `Dissociation Constants`, `Solubility`) issus de HSDB, ILO-ICSC, NIOSH, CAMEO, CRC, EPA et NTP.
  2. **PubChem PUG REST** (par lots de 100 CID) : `IUPACName`, `SMILES` / `ConnectivitySMILES`, `InChIKey`, `Charge`.
  3. **PubChem PUG View** (ciblé sur les candidats retenus) : `Physical Description`, `CAS` et pictogrammes de sécurité **SGH/GHS** (`GHS01`–`GHS09` + mention d’avertissement `Danger` / `Attention`).
  4. **AqSolDB** (*Nature Scientific Data*, Sorkun et al. — **9 982 composés**) : solubilité aqueuse expérimentale (`LogS`), convertie en $\text{g/L}$ via $S = 10^{\text{LogS}} \times M$.
  5. **IUPAC Digitized pKa Dataset** (`IUPAC/Dissociation-Constants` — **9 325 molécules** indexées par IDCode canonique OpenChemLib) : valeurs de $\text{p}K_a$ aqueux haute confiance.
  6. **Courbes de solubilité 0–100 °C** (table de sels inorganiques issue de Wikipédia EN *Solubility table* — **327 sels**).
- **Règles de parsing & garde-fous scientifiques (`scripts/db/lib/parsers.ts`)** :
  - **Validation CAS** : format `XX…X-XX-X` + vérification mathématique de la clé de contrôle officielle.
  - **Températures (fusion / ébullition)** :
    - Normalisation des séparateurs de milliers anglais (`1,412 °C` → `1412 °C`) sans casser les décimales.
    - Suppression des marges d’erreur (`-192.7 + or - 2 °C` → `-192.7 °C`).
    - Rejet des phrases hors-sujet (densité, indice de réfraction, déshydratation d’hydrates, bornes vagues `greater than 212 °F`).
    - **Clustering par consensus (±8 °C)** : plusieurs sources concordantes (avec bonus `@760 mmHg`) l’emportent sur un point aberrant isolé.
    - **Cohérence physique** : rejet automatique des `T° ébullition < T° fusion` non marquées comme sublimation ou décomposition.
  - **Masse volumique** :
    - Conversion `kg/m³` / `g/L` → `g/cm³`.
    - Pour les **gaz** (`standardState === 'gas'`), extraction prioritaire des densités gazeuses explicites en `g/L` (même sur les lignes mentionnant `air = 1`), et rejet strict des densités de gaz liquéfié cryogénique (`>= 0,03 g/cm³` ou mesurées à $T < 0\,^\circ\text{C}$). Si seule une densité liquide cryogénique existe, la densité gazeuse reste `null` (`?`).
  - **Aspect & couleur** : extraction de la forme physique et de la couleur réelle en français ; aucune couleur par défaut n’est fabriquée si elle n’est pas mentionnée.
  - **Structure 2D & déduplication** : conversion `SMILES → Lewis` via **OpenChemLib** (`server/lib/smiles-lewis.ts`), rejet des molécules de plus de 55 atomes lourds et déduplication par clé topologique canonique (`lewis_topology_key`).
- **Porte de complétude pour les espèces Wikipédia** : seules les espèces disposant d’une carte d’identité complète (`IUPAC`, `InChIKey`, `SMILES` + Lewis valide, `CAS` valide, au moins une température de changement d’état, densité expérimentale pour solides/liquides, solubilité aqueuse expérimentale, aspect) sont retenues.
- **Sortie** : `server/data/generated/species-enriched.json` (**1 406 espèces** : 236 curatées enrichies + 1 170 Wikipédia complètes).

### Étape 3 — Constantes pour le moteur de réactions (`scripts/db/3-import-reactions.ts`)
Construit `server/data/generated/reaction-constants.json`, séparé de la table `species` :
- **50 couples redox** ($E^\circ$ en V, demi-équation électronique exacte, milieu, liens vers `species`) — source **CRC Handbook / IUPAC**.
- **38 produits de solubilité** ($\text{p}K_s$, $K_s$, stœchiométrie ionique, couleur du précipité) — source **CRC / IUPAC**.
- **30 couples acide/base** ($\text{p}K_a$ aqueux, acide et base conjugués) — source **IUPAC**.

### Étape 4 — Alliages métallurgiques (`scripts/db/4-import-alloys.ts`)
Construit `server/data/generated/alloys.json` :
- **125 alliages métallurgiques 100 % en français**, compilés et vérifiés à partir des fiches de référence métallurgiques (**ASM Handbook**, **CRC Handbook**, **MatWeb**) et validés automatiquement par le script (absence de doublons, plages massiques min/typique/max cohérentes dont la somme vaut ~100 %, masse volumique, point de fusion, teinte métallique réaliste et description d’usages homogène).
- Répartis en **10 familles** : *Alliages de cuivre* (23), *Aciers & fontes* (18), *Métaux précieux* (17), *Soudures & bas point de fusion* (16), *Superalliages* (12), *Alliages d’aluminium* (10), *Alliages magnétiques* (10), *Ferroalliages* (8), *Titane & réfractaires* (6) et *Alliages légers & zinc* (5).

### Étape 5 — Seeding SQLite (`server/db/seed.ts`)
Assemble dans `data/deltalab.sqlite` :
1. **Éléments (`elements`)** : les **118 éléments** du tableau périodique (`server/data/elements.ts` + `elements-extra.ts`, données IUPAC / CRC).
2. **Espèces (`species`)** en 3 couches :
   - *Couche 1* : les **236 espèces curatées** enrichies par `species-enriched.json` (avec repli vers `elements` pour les constantes thermiques/densité des corps simples monoatomiques curatés comme `Al`, `Ag`, `Ca`, `Cu`, `Fe`).
   - *Couche 1B* : génération automatique des **83 corps simples solides** restants du tableau périodique (`rh_solid`, `pt_solid`, `ti_solid`, `w_solid`, `as_solid`, etc.) afin que chaque élément solide puisse être converti en bloc solide, immergé et allié.
   - *Couche 2* : les **1 170 espèces étendues** de `species-enriched.json` (après déduplication topologique).
3. **Dissolutions, solutions & réactions nommées** : `dissolution_rules` (**204**), `solutions` (**36**), `solution_components` (**72**), `reactions` (**29** réactions curatées de référence), `vessels` (**8** verreries).
4. **Constantes & alliages** : `redox_couples` (**50**), `solubility_products` (**38**), `acid_base_couples` (**30**), `alloys` (**125**).

---

## 4. Résumé des sources scientifiques

| Domaine | Sources principales | Usage dans DeltaLab |
| --- | --- | --- |
| Tableau périodique (118 éléments) | IUPAC, CRC Handbook, données curatées FR (`server/data/elements*.ts`) | Masses atomiques, configurations électroniques, T° fusion/ébullition, densités, réseaux cristallins |
| Noms français & notoriété | Wikipédia FR (`Infobox Chimie`), Wikidata | Noms usuels FR, liens QID/CAS/CID/InChIKey, classement de popularité |
| Identité structurale & Lewis | PubChem PUG REST (NIH), OpenChemLib, schémas curatés (`server/data/lewis.ts`) | Nom IUPAC, SMILES, InChIKey, schémas de Lewis 2D, détection de familles et d’isomères |
| Constantes thermiques & densité | PubChem Bulk Annotations (HSDB, ILO-ICSC, NIOSH, CAMEO, CRC, EPA, NTP) | T° fusion, T° ébullition, sublimation/décomposition, masse volumique, aspect pur |
| Solubilité dans l’eau | AqSolDB (*Nature Scientific Data*), PubChem Solubility, table 0–100 °C | Solubilité à 20 °C (g/L), miscibilité, courbes thermiques 0–100 °C |
| Acidité ($\text{p}K_a$) | IUPAC Digitized pKa Dataset, PubChem Dissociation Constants | Valeurs de $\text{p}K_a$ aqueux, caractère acido-basique |
| Sécurité chimique | PubChem PUG View (SGH / GHS) | Pictogrammes `GHS01`–`GHS09` et mention (`Danger` / `Attention`) |
| Moteur de réactions | CRC Handbook, IUPAC (`3-import-reactions.ts`, `curated-reactions.ts`) | Couples redox $E^\circ$, produits de solubilité $\text{p}K_s$, couples acide/base, réactions nommées |
| Alliages métallurgiques | ASM Handbook, CRC Handbook, MatWeb (`4-import-alloys.ts`) | Compositions massiques, densités, points de fusion, teintes et applications en français |

---

## 5. État & couverture actuels de la base

Après la dernière régénération complète (`seed_version = v16`) :

| Table | Nombre de lignes |
| --- | ---: |
| `elements` | 118 |
| `species` | 1 489 (319 curatées / corps simples + 1 170 base étendue) |
| `dissolution_rules` | 204 |
| `solutions` | 36 |
| `solution_components` | 72 |
| `reactions` | 29 |
| `redox_couples` | 50 |
| `solubility_products` | 38 |
| `acid_base_couples` | 30 |
| `alloys` | 125 |
| `vessels` | 8 |

### Couverture des champs sur `species` (1 489 espèces)

| Champ | Renseigné | Couverture |
| --- | ---: | ---: |
| Solubilité / miscibilité $\text{H}_2\text{O}$ | 1 421 | 95,4 % |
| Aspect pur | 1 410 | 94,7 % |
| Schéma de Lewis 2D | 1 405 | 94,4 % |
| Masse volumique | 1 364 | 91,6 % |
| Numéro CAS / PubChem CID / SMILES | 1 335 | 89,7 % |
| Nom IUPAC | 1 334 | 89,6 % |
| Température de fusion | 1 329 | 89,3 % |
| Pictogrammes SGH/GHS | 1 248 | 83,8 % |
| Température d’ébullition | 1 144 | 76,8 % |
| Valeurs de $\text{p}K_a$ aqueux | 379 | 25,5 % |
| Courbe de solubilité 0–100 °C | 59 | 4,0 % |

Contrôles d’intégrité vérifiés sur la base finale : **0** anomalie `T° ébullition < T° fusion` non expliquée (sublimation/décomposition) et **0** gaz affublé d’une densité liquide cryogénique.
