/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { Range } from 'vs/editor/common/core/range';
import { IModelDecoration } from 'vs/editor/common/model';
import { HoverAnchor, HoverAnchorType, HoverParticipantRegistry, IEditorHoverParticipant, IEditorHoverRenderContext, IHoverPart } from 'vs/editor/contrib/hover/browser/hoverTypes';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IChatWidgetService } from 'vs/workbench/contrib/chat/browser/chat';
import { ChatAgentHover, getChatAgentHoverOptions } from 'vs/workbench/contrib/chat/browser/chatAgentHover';
import { ChatEditorHoverWrapper } from 'vs/workbench/contrib/chat/browser/contrib/editorHoverWrapper';
import { IChatAgentData } from 'vs/workbench/contrib/chat/common/chatAgents';
import { extractAgentAndCommand } from 'vs/workbench/contrib/chat/common/chatParserTypes';

export class ChatAgentHoverParticipant implements IEditorHoverParticipant<ChatAgentHoverPart> {

	public readonly hoverOrdinal: number = 1;

	constructor(
		private readonly editor: ICodeEditor,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
		@ICommandService private readonly commandService: ICommandService,
	) { }

	public computeSync(anchor: HoverAnchor, _lineDecorations: IModelDecoration[]): ChatAgentHoverPart[] {
		if (!this.editor.hasModel()) {
			return [];
		}

		const widget = this.chatWidgetService.getWidgetByInputUri(this.editor.getModel().uri);
		if (!widget) {
			return [];
		}

		const { agentPart } = extractAgentAndCommand(widget.parsedInput);
		if (!agentPart) {
			return [];
		}

		if (Range.containsPosition(agentPart.editorRange, anchor.range.getStartPosition())) {
			return [new ChatAgentHoverPart(this, Range.lift(agentPart.editorRange), agentPart.agent)];
		}

		return [];
	}

	public renderHoverParts(context: IEditorHoverRenderContext, hoverParts: ChatAgentHoverPart[]): IDisposable {
		if (!hoverParts.length) {
			return Disposable.None;
		}

		const store = new DisposableStore();
		const hover = store.add(this.instantiationService.createInstance(ChatAgentHover));
		store.add(hover.onDidChangeContents(() => context.onContentsChanged()));
		const agent = hoverParts[0].agent;
		hover.setAgent(agent.id);

		const actions = getChatAgentHoverOptions(() => agent, this.commandService).actions;
		const wrapper = this.instantiationService.createInstance(ChatEditorHoverWrapper, hover.domNode, actions);
		context.fragment.appendChild(wrapper.domNode);

		return store;
	}
}

export class ChatAgentHoverPart implements IHoverPart {

	constructor(
		public readonly owner: IEditorHoverParticipant<ChatAgentHoverPart>,
		public readonly range: Range,
		public readonly agent: IChatAgentData
	) { }

	public isValidForHoverAnchor(anchor: HoverAnchor): boolean {
		return (
			anchor.type === HoverAnchorType.Range
			&& this.range.startColumn <= anchor.range.startColumn
			&& this.range.endColumn >= anchor.range.endColumn
		);
	}
}

HoverParticipantRegistry.register(ChatAgentHoverParticipant);
