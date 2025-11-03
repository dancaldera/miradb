import { Box, Text } from "ink";
import React from "react";
import type {
	BreadcrumbSegment,
	ConnectionInfo,
	DBType,
} from "../types/state.js";

interface ContextHeaderProps {
	activeConnection: ConnectionInfo | null;
	dbType: DBType | null;
	breadcrumbs: BreadcrumbSegment[];
	recentCommands: string[];
}

export function ContextHeader({
	activeConnection,
	dbType,
	breadcrumbs,
	recentCommands,
}: ContextHeaderProps) {
	// Don't show header if no meaningful context
	if (!dbType && breadcrumbs.length === 0 && recentCommands.length === 0) {
		return null;
	}

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="cyan"
			paddingX={1}
			marginBottom={1}
		>
			{/* Connection Info */}
			{activeConnection && (
				<Box>
					<Text color="cyan" bold>
						Connection:{" "}
					</Text>
					<Text color="green">
						{activeConnection.name || activeConnection.type}
					</Text>
					{activeConnection.connectionString && (
						<Text color="gray" dimColor>
							{" "}
							(
							{activeConnection.connectionString
								.split("://")[1]
								?.split("@")[1] || ""}
							)
						</Text>
					)}
				</Box>
			)}

			{/* Breadcrumb Navigation */}
			{breadcrumbs.length > 0 && (
				<Box>
					<Text color="cyan" bold>
						Path:{" "}
					</Text>
					{breadcrumbs.map((crumb, index) => (
						<React.Fragment key={`breadcrumb-${index}-${crumb.view}`}>
							<Text color="yellow">{crumb.label}</Text>
							{index < breadcrumbs.length - 1 && (
								<Text color="gray" dimColor>
									{" > "}
								</Text>
							)}
						</React.Fragment>
					))}
				</Box>
			)}

			{/* Recent Commands */}
			{recentCommands.length > 0 && (
				<Box>
					<Text color="cyan" bold>
						Recent:{" "}
					</Text>
					<Text color="gray">{recentCommands.slice(-5).join(" → ")}</Text>
				</Box>
			)}
		</Box>
	);
}
