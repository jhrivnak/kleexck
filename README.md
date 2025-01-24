# Kleexck Game

A simple browser-based game built with Angular. Move a red square using arrow keys or WASD.

## Prerequisites

- Node.js (v18 or higher)
- Angular CLI (`npm install -g @angular/cli`)
- FTP access for deployment

## Setup

1. Clone the repository:
```bash
git clone https://github.com/jhrivnak/kleexck.git
cd kleexck
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Configure FTP deployment:
```bash
# Create secret/ftp.json with your FTP credentials
# Format:
{
  "host": "your-ftp-host",
  "user": "your-ftp-user",
  "password": "your-password",
  "port": 21,
  "directory": "/your/upload/directory"
}
```

## Development

1. Start development server:
```bash
ng serve
```
Visit `http://localhost:4200`

2. Run tests:
```bash
ng test
```

3. Lint code:
```bash
ng lint
```

## Deployment

The project uses FTP for deployment. Files are uploaded to a specified directory.

1. Build and deploy:
```bash
node scripts/deploy.js
```

Note: Requires proper FTP credentials in `secret/ftp.json`

## Project Structure

- `src/app/components/game/` - Game component and logic
- `src/app/types/` - TypeScript interfaces and types
- `scripts/` - Deployment and utility scripts
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