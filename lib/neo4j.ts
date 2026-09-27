import neo4j, { type Driver, type Session } from "neo4j-driver";

let driver: Driver | null = null;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta variable de entorno ${name}`);
  return value;
}

export function getDriver(): Driver {
  if (driver) return driver;
  driver = neo4j.driver(
    getEnv("NEO4J_URI"),
    neo4j.auth.basic(getEnv("NEO4J_USER"), getEnv("NEO4J_PASSWORD")),
  );
  return driver;
}

export function getSession(): Session {
  return getDriver().session();
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
