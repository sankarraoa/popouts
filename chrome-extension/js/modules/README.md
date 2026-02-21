# Modular Structure

This directory contains modularized components for the Meeting Notes extension.

## Structure

- `state.js` - Shared state management and persistence
- `sidebar.js` - Sidebar/category management and meeting list
- `agenda-tab.js` - Agenda tab functionality
- `notes-tab.js` - Notes tab functionality  
- `actions-tab.js` - Actions tab functionality (meeting-specific)
- `consolidated-actions.js` - Consolidated actions view
- `meeting-view.js` - Meeting detail view coordination
- `utils.js` - Utility functions (date formatting, etc.)

## Usage

All modules use ES6 imports/exports. The main `sidepanel.js` imports and coordinates these modules.
