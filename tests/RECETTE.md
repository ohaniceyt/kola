# Recette manuelle Kola (téléphone)

À dérouler sur le vrai téléphone à chaque livraison — cocher. Temps : ~10 min.

## 1. Mise à jour & données
- [ ] L'app ouvre sans écran blanc ni sur la version en cache ancienne : Réglages → la ligne version correspond à la livraison du jour
- [ ] Mes données (dépenses, livres, objectifs, paramètres) sont toutes là

## 2. Livres & type
- [ ] Créer un livre 🤝 Dettes (Réglages → Livres → Ajouter) : le segmented 📕/🤝 choix et s'enregistre
- [ ] Basculer entre les deux livres depuis l'accueil (chips) : les données suivent
- [ ] Renommer + changer le type d'un livre existant : rien ne se perd

## 3. Dettes & créances
- [ ] Créer une dette « Je dois » avec montant + échéance → visible dans la liste, ⚠️ si échéance passée
- [ ] Créer une créance « On me doit » → ligne séparée (jamais de net à l'écran)
- [ ] Livre dettes : héros « Je dois » + héros « On me doit », chacun avec sa barre
- [ ] Livre Dépenses : mini héros dettes/créances juste après le héros du mois (caché si aucune dette)

## 4. Remboursements
- [ ] Rembourser部分 (montant ≤ restant) : barre progresse + toast
- [ ] Journal « Historique des remboursements » dans la fiche : lignes datées
- [ ] Supprimer une ligne du journal : le total remboursé suit (la barre redescend)

## 5. Historique dettes (livre 🤝)
- [ ] Filtres Tout / 💸 / 🤝 / 🔁 fonctionnent
- [ ] Recherche par nom : filtre correctement
- [ ] Tap sur une entrée → fiche correspondante

## 5bis. Rappels d'échéances (le soir, après 18h)
- [ ] À l'ouverture du soir, une dette dont l'échéance est ≤ 7 jours (ou dépassée) apparaît dans « ⏰ Échéances à venir »
- [ ] Tap sur le rappel → la fiche de la dette s'ouvre (basculant de livre si besoin)
- [ ] Une dette soldée ou sans échéance n'apparaît pas

## 6. Dépenses classiques (livre 📕)
- [ ] ＋ → saisie rapide / pavé numérique / catégorie : la dépense s'ajoute
- [ ] Tap sur la dépense → Modification ; « Même dépense aujourd'hui » ; suppression
- [ ] Les dettes d'un livre dépenses sont visibles via la carte 🤝 (bouton ＋ Dette)

## 7. Sauvegarde & multi-appareils
- [ ] Exporter le JSON (Données → Sauvegarder & exporter) : le fichier contient dettes + remboursements
- [ ] Import du même fichier : « Fusionner » ne double aucune entrée ; « Remplacer » recharge tout
- [ ] (Facultatif) Réel transfert vers un autre appareil

## 8. Résilience
- [ ] Mode avion : ouverture + saisie OK
- [ ] Tuer l'app et revenir : tout est restauré
- [ ] Thème par livre : le thème suit le livre activé

## 9. International
- [ ] English : écrans dettes/historique traduits

## 10. Hygiène
- [ ] Aucun toast/erreur bizarre en usage normal
- [ ] Si un bug : capture + note ici → issue