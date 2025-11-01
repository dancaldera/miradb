import { Box, Text } from "ink";
import type React from "react";

interface ViewBuilderProps {
	title: string;
	subtitle?: string;
	footer?: string;
	children: React.ReactNode;
}

export const ViewBuilder: React.FC<ViewBuilderProps> = ({
	title,
	subtitle,
	footer,
	children,
}) => {
	return (
		<Box
			flexDirection="column"
			paddingX={1}
			paddingY={1}
			borderStyle="round"
			borderColor="cyan"
		>
			<Text color="cyan" bold>
				{title}
			</Text>
			{subtitle && <Text dimColor>{subtitle}</Text>}
			<Box marginTop={1} flexDirection="column">
				{children}
			</Box>
			{footer && (
				<Box marginTop={1}>
					<Text dimColor>{footer}</Text>
				</Box>
			)}
		</Box>
	);
};
