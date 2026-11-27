# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Inventory Management System


## Role Agent:
A web developer senior with 25 years the experience.

## General objective

 Create an application web, to manage and inventory the fixed assets of one church, so that one specific user with permissions can register, classify,track and get reports of the assets in a simple way. 


- The application will allow users to add new assets, update existing ones, and generate reports on the inventory status.
- The application will provide a user-friendly interface for managing assets, including features such as search, filter, and sort.
- The application will support multiple users with different roles and permissions, allowing for secure access to the inventory data.

  
## Rules
 
 - apply documentation before every implementation or change
 - code based on High cohesion, low coupling
 - clean code
 - Don't allow excess data.
  - every error, must be controlled.
 - if the route does not exist, make callback to the login page.
 - build a yml file to deploy the application in github page, and configure the firebase.json file to allow the SPA to work properly.

## Architecture
modular architecture

## Application type
Web

## Technology Stack 
HTML, JavaScript,css, firebase, firebase authentication, firebase firestore, firebase storage.

## INTERFACE STYLE
- soft colors, simple
- eye-friendly.
- Minimalist design, with a focus on usability and accessibility.
- ADHD-friendly mode
- Versatile design, with the ability to switch between light and dark modes.
- automatic adaptation to different screen sizes and devices, including desktops, tablets, and smartphones.
  

## EndUser type
- Old People and young people, with different levels of technical expertise.

## Application Functionalities
- Manage and track the fixed assets of the church.
- Classify assets by categories and tags.
- Generate PDF reports on the inventory status, including asset details, location, and condition.
- Provide a dashboard with key indicators on the inventory status, such as total assets, assets by category, and assets by location.
- Allow users to upload images of assets and store them in Firebase Storage.
- allow users to use the camera of the device to take a picture of the asset and upload it to the system.
- The user will be able to inventory-taking process through a grid/table to view and update the status of assets, including their location, condition, and availability.
  
## THERMINOLOGY
- "Articulo": any fixed asset of the church, such as furniture, equipment, vehicles, etc.  
- "Departamento": a department or ministry of the church that is responsible for managing a specific category of assets.
- "Ubicacion": the physical location of an asset, such as a room, building, or outdoor area.
- "Categoria": a category or type of asset, such as furniture, equipment, vehicles, etc.
- "Etiqueta": a tag or label that can be assigned to an asset for classification or tracking purposes.
- "Usuario": a user of the application, who can have different roles and permissions for managing the assets.
- "IASD": abbreviation for "Iglesia Adventista del Séptimo Día", the Spanish name for the Seventh-day Adventist Church.

## Current state

Static SPA in plain HTML + JavaScript (ES modules, no build step) + CSS, with Firebase Auth / Firestore /
Storage loaded from the CDN (version pinned only in `js/core/firebase.js`). Hash routing (`#/path`).
Node 20.20.2 is pinned with Volta (the machine default is Node 14, which is too old; Volta switches
automatically inside this folder) and is used only for the dev server and tests.

Read `docs/architecture.md` (layers, module rules), `docs/data-model.md` (collections, limits) and
`docs/deployment.md` (Firebase setup, first admin, GitHub Pages) before changing code.
The interface uses the THERMINOLOGY above ("Artículo", never "bien"); its mapping to collections/fields
(Articulo=`assets`, Categoria=`assetTypes`, Departamento=`categories`, Ubicacion=`locations`) is in
`docs/data-model.md`.
Field lists/limits live in three places that must stay in sync: `js/config/app-config.js`,
the `*.model.js` files, and `firestore.rules` / `storage.rules`.

### Commands
- Dev server: `npm start` (http://localhost:8080)
- All tests: `npm test` (node --test, pure modules only)
- Single test file: `node --test tests/asset.model.test.js`
- Deploy rules: `firebase deploy --only firestore:rules,firestore:indexes,storage`
- Deploy site: push to `main` (GitHub Actions → Pages) or `firebase deploy --only hosting`

### Repository and Database 
url firebase: https://console.firebase.google.com/project/db-vintocentral
repository: https://github.com/moiquix7/vintocentral

