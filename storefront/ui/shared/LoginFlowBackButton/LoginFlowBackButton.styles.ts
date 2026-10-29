import styled from 'styled-components';

/** Flutter: Container(34×34) + Icon(size 16) */
const BUTTON_SIZE = 34;
const ICON_SIZE = 16;

/** InkWell(radius md) > Container(border fieldBorder) > Icon(arrow_back_rounded) */
export const Button = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${BUTTON_SIZE}px;
  height: ${BUTTON_SIZE}px;
  padding: 0;
  background: transparent;
  border: 1px solid ${({ theme }) => theme.loginFlow.fieldBorder};
  border-radius: ${({ theme }) => theme.radius.md}px;
  cursor: pointer;
  color: ${({ theme }) => theme.components.icon.color};

  .pi {
    font-size: ${ICON_SIZE}px;
  }
`;
