// ASCII splash (generated with figlet -f nancyj)

const SPLASH = `
dP dP                  dP 
88 88                  88 
88 88 88d8b.d8b. .d888b88 
88 88 88'\`88'\`88 88'  \`88 
88 88 88  88  88 88.  .88 
dP dP dP  dP  dP \`88888P8 
`;

// Pure function: generate splash text
export const generateSplash = (): string => SPLASH;

// Side effect: print splash to console
export const printSplash = (): void => {
  console.log(generateSplash());
};
