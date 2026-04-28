import { CommandRegistry } from '@/command/registry';
import { CommandDispatcher } from '@/command/dispatcher';
import type { CommandServices } from '@/command/types';
import type { EventBus } from '@/core/event-bus';
import { fileCommands } from '@/command/commands/file';
import { editCommands } from '@/command/commands/edit';
import { viewCommands } from '@/command/commands/view';
import { formatCommands } from '@/command/commands/format';
import { insertCommands } from '@/command/commands/insert';
import { tableCommands } from '@/command/commands/table';
import { pageCommands } from '@/command/commands/page';
import { toolCommands } from '@/command/commands/tool';

export function createCommandRuntime(params: {
  commandServices: CommandServices;
  eventBus: EventBus;
}): {
  registry: CommandRegistry;
  dispatcher: CommandDispatcher;
} {
  const registry = new CommandRegistry();
  const dispatcher = new CommandDispatcher(registry, params.commandServices, params.eventBus);

  registry.registerAll(fileCommands);
  registry.registerAll(editCommands);
  registry.registerAll(viewCommands);
  registry.registerAll(formatCommands);
  registry.registerAll(insertCommands);
  registry.registerAll(tableCommands);
  registry.registerAll(pageCommands);
  registry.registerAll(toolCommands);

  return { registry, dispatcher };
}
