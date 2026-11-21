# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Lycéens, étudiants en chimie (faculté / classes préparatoires) et enseignants utilisant DeltaLab comme outil de cours, de révision et d'expérimentation virtuelle sur ordinateur.

## Product Purpose

DeltaLab est un laboratoire de chimie interactif en bac à sable sur un canvas infini : manipuler des atomes depuis le tableau périodique, les assembler en molécules connues, préparer des solutions aqueuses dans de la verrerie de laboratoire et préparer le socle pour de futures réactions, dilutions et calculs de concentrations.

## Positioning

Un espace de travail de chimie tactile façon Infinite Craft ancré dans une véritable base de données relationnelle SQLite : chaque élément, molécule, ion, fiole, règle de dissolution et solution est modélisé en base avec son comportement chimique explicite, plutôt que par des scripts ad hoc.

## Operating Context

- Interface entièrement en français, vocabulaire scientifique lycée–université (formules chimiques normalisées, états physiques, dissociation ionique).
- Utilisation en mode sombre minimaliste façon outil de précision (shadcn/ui, icônes Lucide, densité maîtrisée, textes réduits à l'essentiel).
- Architecture locale : frontend React/Vite connecté à une API locale adossée à SQLite (`data/deltalab.sqlite`).

## Capabilities and Constraints

- Canvas infini (pan, zoom, drag & drop, sélection multiple par zone ou Shift+clic).
- Tableau périodique des 118 éléments en bas, permettant de glisser-déposer des atomes sur le canvas.
- Fusion d'atomes sélectionnés en une molécule si sa composition exacte existe en base.
- Panneau latéral droit à deux onglets : Inspecteur (réservé aux prochaines fonctionnalités) et Outils (verrerie / fioles pour solutions).
- Préparation de solutions aqueuses dans les fioles : ajout obligatoire d'eau (H₂O) en premier, puis ajout de solutés solubles ou d'autres solutions aqueuses selon les règles stockées en base.
- Base SQLite conçue pour accueillir ensuite les réactions chimiques, calculs de concentrations, pH et dilutions.

## Brand Commitments

- Nom : DeltaLab.
- Esthétique imposée par le brief : dark mode, shadcn/ui, minimaliste, icônes Lucide, interface épurée sans surcharge textuelle.

## Product Principles

- La chimie fait foi : chaque fusion et dissolution repose sur les données et règles de la base relationnelle.
- L'outil s'efface devant la manipulation : chrome discret, icônes claires, feedback immédiat et silencieux.
- Socle extensible : le header, l'inspecteur et le schéma SQLite sont conçus pour accueillir réactions, concentrations et dilutions sans refonte.
