import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useAppDispatch, useAppState } from '../state/context.js';
import { ViewState } from '../types/state.js';
import { ActionType } from '../state/actions.js';
import { ViewBuilder } from './ViewBuilder.js';

export const QueryHistoryView: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const validHistory = state.queryHistory.filter(item => item.query.trim());
  const selectedQuery = validHistory[selectedIndex];

  useInput((input, key) => {
    if (key.escape) {
      dispatch({ type: ActionType.SetView, view: ViewState.Query });
    }
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
    if (key.downArrow && selectedIndex < validHistory.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
    if (input === 'r' && selectedQuery) {
      // Re-run the selected query
      dispatch({ type: ActionType.SetView, view: ViewState.Query });
      // Set the query text in the QueryView (this would need to be handled by state)
    }
    if (input === 'c' && selectedQuery) {
      // Copy query to clipboard
      // This would require clipboard integration
    }
  });

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <ViewBuilder
      title="Query History"
      subtitle={`${validHistory.length} quer${validHistory.length === 1 ? 'y' : 'ies'} in history`}
      content={
        validHistory.length === 0 ? (
          <Box flexDirection="column">
            <Text color="gray">No queries executed yet.</Text>
            <Text color="gray">Execute some queries from the Query view to see them here.</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="blue">Recent Queries:</Text>
              <Text color="gray" dimColor>
                ↑/↓: Navigate | 'r': Re-run | 'c': Copy | Esc: Back to Query
              </Text>
            </Box>

            {validHistory.map((item, index) => (
              <Box
                key={item.id}
                flexDirection="column"
                marginBottom={index === selectedIndex ? 1 : 0}
                backgroundColor={index === selectedIndex ? 'blue' : undefined}
              >
                <Box flexDirection="column" paddingX={1}>
                  <Text color={item.error ? 'red' : 'green'}>
                    {item.error ? '✗' : '✓'} {formatDate(item.executedAt)}
                    {' • '}{formatDuration(item.durationMs)}
                    {' • '}{item.rowCount} rows
                  </Text>
                  <Text
                    color={index === selectedIndex ? 'white' : 'gray'}
                    dimColor={index !== selectedIndex}
                  >
                    {item.query.length > 80 ? item.query.substring(0, 77) + '...' : item.query}
                  </Text>
                  {item.error && (
                    <Text color="red">
                      Error: {item.error}
                    </Text>
                  )}
                </Box>
              </Box>
            ))}

            {selectedQuery && (
              <Box marginTop={1} flexDirection="column">
                <Text color="cyan" bold>Selected Query Details:</Text>
                <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
                  <Text color="white">{selectedQuery.query}</Text>
                  <Box marginTop={1}>
                    <Text color="gray">
                      Executed: {formatDate(selectedQuery.executedAt)}
                    </Text>
                    <Text color="gray">
                      Duration: {formatDuration(selectedQuery.durationMs)}
                    </Text>
                    <Text color="gray">
                      Rows: {selectedQuery.rowCount}
                    </Text>
                    {selectedQuery.error && (
                      <Text color="red">
                        Error: {selectedQuery.error}
                      </Text>
                    )}
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        )
      }
      helpText={`
Query History Help:
• ↑/↓: Navigate through query history
• 'r': Re-run selected query (returns to Query view)
• 'c': Copy selected query to clipboard
• Esc: Go back to Query view
• Shows last 100 executed queries
• Green ✓ = successful, Red ✗ = failed
              `.trim()}
    />
  );
};