---
name: DeltaLab
description: Paillasse de chimie numérique minimaliste en mode sombre shadcn/ui.
colors:
  canvas-ground: "#09090b"
  chrome-panel: "#0e0e11"
  surface-card: "#131317"
  surface-muted: "#18181d"
  surface-secondary: "#1c1c22"
  surface-hover: "#22222a"
  hairline-border: "#23232b"
  ink-primary: "#f4f4f5"
  ink-secondary: "#e4e4e7"
  ink-muted: "#8f8f9d"
  focus-ring: "#d4d4d8"
  status-connected: "#34d399"
  status-warning: "#f59e0b"
  status-danger: "#dc2626"
  water-meniscus: "#bae6fd"
typography:
  title:
    fontFamily: "Geist Variable, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Variable, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Geist Variable, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
  mono-data:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.625rem"
    fontWeight: 400
    lineHeight: 1.2
rounded:
  xs: "4px"
  sm: "5px"
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.canvas-ground}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "28px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    height: "28px"
    width: "28px"
  canvas-tile:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  panel-tab-active:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

# Design System: DeltaLab

## Overview

**Creative North Star: "La Paillasse de Précision"**

DeltaLab suit une esthétique d'outil scientifique minimaliste en mode sombre dérivée de shadcn/ui : l'interface demeure volontairement achromatique (échelle zinc-obsidienne délimitée par des filets nets de 1 px) afin que seuls les symboles chimiques, les pastilles de familles périodiques et la couleur physique réelle des solutions aqueuses dans la verrerie captent le regard.

L'application fonctionne en mode **Operate** : chaque contrôle privilégie l'icône Lucide (trait fin 1,5–1,6 px), l'action directe par glisser-déposer et la lisibilité instantanée des formules sans surcharge textuelle ni effets décoratifs superflus.

**Key Characteristics:**
- Monochromie sombre stricte pour le chrome (bandeau, panneaux, boutons) ; la couleur est réservée aux propriétés chimiques réelles et aux états sémantiques.
- Densité maîtrisée permettant d'afficher les 118 éléments du tableau périodique tout en préservant un large canvas infini.
- Feedback physique et silencieux : niveau de liquide animé par transformation GPU, léger tremblement en cas de règle chimique refusée, pastilles d'ions dissous.

## Colors

Palette zinc sombre à contraste maîtrisé, structurée autour de quatre marches de luminosité et d'accents strictement sémantiques ou chimiques.

### Primary
- **Craie de Paillasse** (token `ink-primary`): Action principale (bouton *Fusionner*), texte de premier plan et anneaux de sélection active.

### Neutral
- **Obsidienne de Paillasse** (token `canvas-ground`): Fond du canvas infini avec trame micro-points réactive au zoom (`rgba(255,255,255,0.085)`).
- **Ardoise Chrome** (token `chrome-panel`): Bandeau supérieur, panneau latéral droit et dock du tableau périodique.
- **Carbone Tuile** (token `surface-card`): Atomes, molécules, fioles, cartes de verrerie et popovers.
- **Zinc Muted / Hover** (tokens `surface-muted`, `surface-secondary`, `surface-hover`): Onglets inactifs, badges d'ions et états de survol.
- **Filet Structurel** (token `hairline-border`): Séparateurs 1 px entre zones d'outil et bordures de tuiles au repos.
- **Gris Mesure** (token `ink-muted`): Légendes secondaires, états physiques, volumes et numéros atomiques.

### Named Rules
**The Chemical Color Rule.** Le chrome ne porte aucune couleur décorative : les teintes vives (`Cu²⁺` bleu cuivre, `MnO₄⁻` violet permanganate, `Fe³⁺` ambre, `CuCl₂` sarcelle) proviennent exclusivement des données chimiques stockées en base SQLite et des micro-points de familles périodiques.

## Typography

**Body & UI Font:** `Geist Variable` (fallback système sans-serif).
**Data / Measurement Font:** `JetBrains Mono Variable` (fallback monospace).

**Character:** Une seule famille sans-serif sobre porte toute l'interface ; la chasse fixe est réservée sans exception aux grandeurs mesurées et indices scientifiques (`tabular-nums` systématique).

### Hierarchy
- **Title** (600, 14 px, line-height 1.25): Formules de molécules sur le canvas et marque DeltaLab.
- **Body** (400–500, 12 px, line-height 1.4): Libellés d'onglets, noms de verrerie, noms de solutions et retours d'état.
- **Label** (500, 11 px, line-height 1.2): Entêtes de sections latérales, infobulles et filtres.
- **Mono Data** (400, 9–10 px, `tabular-nums`): Numéros atomiques, capacités (mL), pH, pourcentage de zoom et compteurs de base.

### Named Rules
**The Measured Mono Rule.** Ne jamais utiliser la police monospace comme simple style visuel sur des titres ou phrases ; elle ne sert que les valeurs numériques, unités, raccourcis clavier et badges d'état physique (`s`, `l`, `g`, `aq`).

**The Constant Font-Weight Selection Rule.** Ne jamais changer la graisse du texte (`font-normal` → `font-medium` / `font-semibold` / `font-bold`) lorsqu'une option est sélectionnée dans un sélecteur horizontal, une barre d'onglets, un contrôle segmenté ou une rangée de filtres : le changement de graisse modifie la largeur du texte et décale tous les boutons voisins. Conserver une graisse identique et constante (ex. `font-medium` en permanence) et signaler la sélection uniquement par le fond (`bg-accent` / `bg-card`), la couleur de texte (`text-foreground`) ou une bordure/filet.

## Layout

Architecture plein écran sans défilement global (`100vw × 100vh`) divisée en quatre zones orthogonales séparées par des filets `1px` :
1. **Header supérieur fixe** (`44px`): Marque à gauche, zone centrale libre pour les modules futurs, actions icônes compactes à droite.
2. **Canvas infini** (espace central fluide): Pan/zoom, sélection par rectangle, barre contextuelle flottante centrée en haut, contrôles de vue ancrés en bas à gauche (`12px` d'inset).
3. **Tableau périodique ancré en bas**: Barre d'entête `32px` + grille authentique 18 colonnes × 9 lignes (bloc f séparé de `5px`), repliable à tout moment. Sur mobile, la grille reste lisible via défilement horizontal interne (`min-width: 700px`).
4. **Panneau latéral droit** (`288px` fixe sur `≥1024px`, tiroir coulissant sur mobile/tablette): Onglets *Inspecteur* / *Outils* en tête.

## Elevation & Depth

Hiérarchie fondée prioritairement sur l'étagement tonal (`#09090b` → `#0e0e11` → `#131317`) et des bordures `1px`. Les ombres portées restent douces et réservées aux éléments flottants au-dessus du canvas (tuiles manipulables, barre contextuelle de fusion, fantôme de glisser-déposer et popovers).

## Shapes

Rayons mesurés et cohérents : micro-cellules du tableau périodique à `4px`, boutons et onglets à `5px–8px`, tuiles du canvas (atomes, molécules, fioles) à `12px`, pilules de feedback en `9999px`. Aucune bordure latérale colorée épaisse.

## Components

### Buttons
- **Shape:** Coins arrondis doux (`8px`, `6px` en taille compacte).
- **Cursor:** Curseur flèche natif (`cursor: default`), jamais `cursor: pointer`.
- **Primary:** Fond craie (`ink-primary`) et texte obsidienne (`canvas-ground`) réservé à l'action *Fusionner*.
- **Ghost / Icon:** Fond transparent, icône `14px` trait `1.6px`, passage au fond `surface-hover` au survol.

### Named Rules
**The Native Desktop Cursor Rule.** En raison de la forte densité d'éléments interactifs de l'interface, ne jamais appliquer `cursor: pointer` sur les boutons, onglets, filtres, lignes de tableau ou badges cliquables : tous les contrôles UI conservent le curseur flèche natif (`default`), comme dans une application desktop. Seules les interactions de manipulation directe utilisent un curseur dédié (`grab` / `grabbing` / `copy`).

**The Instant Interactive Surface Rule.** Ne jamais appliquer `transition-colors` ni de transition CSS sur `background-color` / `border-color` des boutons, onglets, filtres, lignes de tableau ou champs : les changements d'état au survol et au clic doivent être instantanés (comme dans une application desktop native) afin d'éviter le flash/blink d'interpolation `color-mix(in oklab, …)` de Tailwind v4 et de garder une réactivité nette. Réserver les transitions uniquement aux animations physiques (`transform`, `opacity`).

### Canvas Tiles (Atomes, Molécules, Fioles)
- **Corner Style:** `12px`.
- **Background:** `surface-card` avec bordure `1px` `hairline-border` au repos, anneau clair (`2px` à 20–25% d'opacité) en sélection, halo bleu ciel ou ambre lors d'un survol de dépôt sur une fiole.
- **Verrerie SVG:** Silouhettes vectorielles propres (`Fiole jaugée`, `Erlenmeyer`, `Bécher`, `Tube à essai`) avec niveau de liquide masqué par `clipPath` et animé uniquement via `transform: translateY(...)` (`320ms cubic-bezier(0.16, 1, 0.3, 1)`).

### Tabs (Inspecteur / Outils)
- Piste encadrée `bg-muted` (`32px` de haut), onglet actif surélevé en `surface-card` avec icône Lucide + libellé court.

## Do's and Don'ts

### Do:
- **Do** conserver le chrome strictement neutre (`#09090b`–`#23232b`) et laisser les espèces chimiques et solutions porter la couleur (et jamais des accents décoratifs sur des labels comme « Produits » ou des pilules néon).
- **Do** séparer les sections denses par des traits fins (`1px border-border/60`) et des espacements généreux plutôt que d’empiler des boîtes encadrées imbriquées.
- **Do** utiliser des textes gris flottants pour les métadonnées (`ΔE°`, `%`, `limitant`, types) et des boutons icône flottants (`hover:bg-accent`) plutôt que de gros boutons encadrés quand une icône suffit.
- **Do** utiliser les icônes Lucide (`strokeWidth` 1.5–1.6) uniquement lorsqu’elles portent une action réelle (jamais d’icône décorative devant un titre de section).
- **Do** animer les changements d'état uniquement via `transform` et `opacity` (150–320 ms).

### Don't:
- **Don't** abuser des boîtes, conteneurs encadrés, pilules colorées « effet néon » (`border-color/30 bg-color/10 text-color-300`), icônes décoratives ou labels redondants quand les valeurs parlent déjà d’elles-mêmes.
- **Don't** mettre `transition-colors` ou animer `background-color` / `border-color` sur les boutons, onglets, filtres ou lignes au survol/clic (The Instant Interactive Surface Rule) — garder un feedback instantané sans blink.
- **Don't** changer la graisse du texte (`font-medium`, `font-semibold`, `font-bold`) sur l'état actif/sélectionné d'un bouton, onglet, filtre ou contrôle segmenté (The Constant Font-Weight Selection Rule) — cela décale horizontalement tous les boutons adjacents.
- **Don't** utiliser `cursor: pointer` (`cursor-pointer`) sur les boutons, onglets, filtres, puces ou lignes du site — conserver le curseur `default` sur tous les contrôles UI (The Native Desktop Cursor Rule).
- **Don't** ajouter de néon, de textes en dégradé, de glassmorphisme décoratif ou de bordures latérales colorées épaisses.
- **Don't** coder en dur des comportements chimiques dans l'UI : toute fusion, solubilité, couleur de solution ou dissociation doit être lue depuis SQLite.
- **Don't** encombrer le canvas avec des panneaux persistants ou des textes explicatifs longs une fois la paillasse active.
