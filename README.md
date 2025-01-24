# Kleexck Game

A simple browser-based game built with Angular. Move a red square using arrow keys or WASD.

## Prerequisites

- Node.js (v18 or higher)
- Angular CLI (`npm install -g @angular/cli`)
- FTP access for deployment

## Local Development

Quick start:
```bash
node scripts/dev.js start    # Start local server
node scripts/dev.js test     # Run tests
node scripts/dev.js deploy   # Deploy to dev
node scripts/dev.js verify   # Check dev site
```

1. Start the development server:
```bash
ng serve
```
This will:
- Start a local server at `http://localhost:4200`
- Enable hot reload (changes appear instantly)
- Show compilation errors in real-time

2. Make your changes:
- Edit files in `src/` directory
- Changes will automatically refresh in browser
- Check browser console (F12) for errors

3. Test your changes:
```bash
ng test                 # Run unit tests
ng serve               # Manual testing in browser
```

## Deploying to Dev

When your changes are ready for the dev site:

1. Commit your changes:
```bash
git add .
git commit -m "your message"
git push
```

2. Deploy to dev.kleexck.com:
```bash
node scripts/dev.js deploy
```

This will:
- Build the app for production
- Upload files to `/cursor/` directory
- Game will be available at https://dev.kleexck.com/

3. Verify deployment:
```bash
node scripts/dev.js verify   # Quick status check
```
Then manually:
- Check https://dev.kleexck.com/
- Test all features
- Check browser console for errors

## Project Structure

- `src/app/components/game/` - Game component and logic
- `src/app/types/` - TypeScript interfaces and types
- `scripts/` - Deployment and utility scripts
  - `dev.js` - Development helper commands
  - `deploy.js` - FTP deployment script
- `config/` - Configuration files
- `secret/` - Credentials (not in git)

## Security Notes

- Never commit files from the `secret/` directory
- Keep FTP credentials secure
- Use environment variables for sensitive data

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT License - See LICENSE file 