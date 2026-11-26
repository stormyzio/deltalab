# Base de données DeltaLab (`data/deltalab.sqlite`)

Ce document décrit l’architecture et le contenu vérifié de la base SQLite embarquée de DeltaLab.

---

## 1. Architecture & fonctionnement

- **Moteur** : SQLite local via `node:sqlite` (`DatabaseSync`), stocké dans `data/deltalab.sqlite` (schéma défini dans `server/schema.sql`).
- **Auto-seeding versionné (`server/db/seed.ts`)** : au démarrage du serveur Hono, une signature `seed_version` est calculée à partir des définitions curatées et des constantes de réactions. Toute mise à jour déclenche un re-seeding atomique (`BEGIN TRANSACTION` … `COMMIT`).
- **Source de vérité unique & 100 % curatée** : plus aucun import externe ni fichier généré intermédiaire. Chaque espèce du noyau dispose de constantes expérimentales vérifiées (T° fusion, T° ébullition ou décomposition/sublimation, densité, solubilité, couleurs à l’état pur et en solution, sécurité SGH, schéma de Lewis 2D, usages pratiques et tests caractéristiques).

---

## 2. Structure des données (`server/data/`)

1. **Éléments (`server/data/elements.ts` + `elements-extra.ts`)** :
   - Les **118 éléments** du tableau périodique (masses atomiques IUPAC, configurations électroniques, T° fusion/ébullition, densités, réseaux cristallins, charges ioniques courantes).
2. **Noyau d’espèces & ions polyatomiques (`server/data/species/*.ts`)** :
   - **94 espèces principales** (36 molécules, 49 composés ioniques/oxydes/précipités, 9 corps simples moléculaires `H₂`, `O₂`, `O₃`, `N₂`, `F₂`, `Cl₂`, `Br₂`, `I₂`, `S₈`) réparties dans `solvents.ts`, `acids-bases.ts`, `salts.ts`, `molecules.ts` et `organics.ts`.
   - **22 ions polyatomiques clés** dans `ions.ts` (`H₃O⁺`, `OH⁻`, `NH₄⁺`, `NO₃⁻`, `SO₄²⁻`, `CO₃²⁻`, `HCO₃⁻`, `MnO₄⁻`, `Cr₂O₇²⁻`, `S₂O₃²⁻`, `[Cu(NH₃)₄]²⁺`…).
   - **94 règles de dissolution** et **35 solutions aqueuses nommées** dérivées directement de ces définitions.
3. **Ions monoatomiques complets (`server/data/species/monatomic-ions.ts`)** :
   - **116 ions monoatomiques** couvrant tous les éléments non-gaz-nobles du tableau périodique (`H⁺`/`H⁻`, `C⁴⁻`, alcalins, alcalino-terreux, métaux de transition `Ti³⁺`/`Ti⁴⁺`, `V²⁺`/`V³⁺`, `Cr²⁺`/`Cr³⁺`, `Mn²⁺`/`Mn³⁺`, `Fe²⁺`/`Fe³⁺`, `Cu⁺`/`Cu²⁺`, `Au⁺`/`Au³⁺`, halogénures, chalcogénures, lanthanides, actinides) avec noms IUPAC français, références CAS/PubChem, vraies teintes aqueuses, tests de flamme et schémas de Lewis.
4. **Corps simples solides (`Layer 1B` dans `server/db/seed.ts`)** :
   - **105 corps simples solides** rattachés aux éléments solides du tableau périodique pour la création de blocs solides, l’immersion en verrerie et la fusion d’alliages.
5. **Réactions & constantes (`server/data/reactions/curated-reactions.ts` + `constants.json`)** :
   - **29 réactions nommées**, **46 couples redox ($E^\circ$)**, **35 produits de solubilité ($\text{p}K_s$)** et **21 couples acide/base ($\text{p}K_a$)**.
6. **Alliages métallurgiques (`server/data/alloys.json`)** :
   - **125 alliages métallurgiques** en français répartis en 10 familles (compositions massiques, densités, points de fusion, couleurs et usages).
7. **Verrerie (`server/data/vessels.ts`)** :
   - **8 types de verrerie** avec capacités disponibles, tolérances de chauffage/bouchon et précision.
