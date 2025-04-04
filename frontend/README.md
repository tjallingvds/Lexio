# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```

## Environment Variables

This project uses environment variables for sensitive information like API keys. To set up:

1. Create a `.env.local` file in the frontend directory (this won't be committed to Git)
2. Add your API keys:
   ```
   VITE_OPENAI_API_KEY=your_actual_openai_key_here
   VITE_UPLOADTHING_API_KEY=your_actual_uploadthing_key_here
   ```
3. The application will automatically use these values

> ⚠️ **IMPORTANT:** Never commit API keys directly in your code or push the `.env.local` file to version control! 

### API Key Security Best Practices

- The `.env.local` file is already in `.gitignore` to prevent accidentally committing secrets
- If using a CI/CD pipeline, set environment variables there rather than in files
- For production deployments, use proper secret management offered by your hosting provider 
- Consider rotating API keys periodically
- For server-side endpoints, avoid exposing the API key to the frontend when possible
- If your API key has been compromised, regenerate it immediately in your OpenAI dashboard

You can obtain an OpenAI API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
