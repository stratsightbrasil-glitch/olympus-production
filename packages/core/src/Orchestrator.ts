import { Agent } from "./Agent";
import { AgentContext } from "./types";

export class Orchestrator {
  private agents: Map<string, Agent> = new Map();

  constructor(public name: string = "HERMES") {}

  registerAgent(agent: Agent) {
    this.agents.set(agent.name, agent);
  }

  getAgent(name: string): Agent {
    const agent = this.agents.get(name);
    if (!agent) throw new Error(`[Orquestrador] Agente ${name} não registrado.`);
    return agent;
  }

  async dispatch(agentName: string, input: string, context: AgentContext, vizMode?: string): Promise<string> {
    const agent = this.getAgent(agentName);
    console.log(`[${this.name}] Delegando análise para o agente ${agent.name}...`);
    return await agent.run(input, context, vizMode);
  }
}