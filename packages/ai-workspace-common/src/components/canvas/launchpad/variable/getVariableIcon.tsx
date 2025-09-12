import {
  AiChat,
  Doc2,
  Audio,
  Code1,
  Image,
  Video,
  Web1,
  Note,
  Group,
  List,
  Attachment,
  Icon,
  Text1,
} from 'refly-icons';
export const getVariableIcon = (type: string) => {
  switch (type) {
    // Start node variable types
    case 'string':
      return <Text1 size={14} color="#0E9F77" />;
    case 'option':
      return <List size={14} color="#0E9F77" />;
    case 'resource':
      return <Attachment size={14} color="#0E9F77" />;

    // Node types for step and result records
    case 'document':
      return <Doc2 className="bg-[#0062D6] rounded-md p-1" size={20} color="white" />;
    case 'audio':
      return <Audio className="bg-[#F93920] rounded-md p-1" size={20} color="white" />;
    case 'startNode':
    case 'skillResponse':
    case 'mediaSkillResponse':
      return <AiChat className="bg-[#FC8800] rounded-md p-1" size={20} color="white" />;
    case 'resourceLibrary':
      return <AiChat className="bg-[#FC8800] rounded-md p-1" size={20} color="white" />;
    case 'code':
    case 'codeArtifact':
      return <Code1 className="bg-[#0062D6] rounded-md p-1" size={20} color="white" />;
    case 'image':
      return (
        <Image
          className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-md p-1"
          size={20}
          color="white"
        />
      );
    case 'video':
      return <Video className="bg-[#F93920] rounded-md p-1" size={20} color="white" />;
    case 'website':
      return <Web1 className="bg-[#12B76A] rounded-md p-1" size={20} color="white" />;
    case 'memo':
      return <Note className="bg-[#F79009] rounded-md p-1" size={20} color="white" />;
    case 'skill':
    case 'mediaSkill':
      return <AiChat className="bg-[#12B76A] rounded-md p-1" size={20} color="white" />;
    case 'tool':
    case 'toolResponse':
      return <AiChat className="bg-[#F79009] rounded-md p-1" size={20} color="white" />;
    case 'group':
      return <Group className="bg-[#667085] rounded-md p-1" size={20} color="white" />;
    case 'step':
      return <AiChat className="bg-[#12B76A] rounded-md p-1" size={20} color="white" />;
    case 'result':
      return <AiChat className="bg-[#155EEF] rounded-md p-1" size={20} color="white" />;
    default:
      return <AiChat className="bg-[#667085] rounded-md p-1" size={20} color="white" />;
  }
};
export const getStartNodeIcon = (type: string) => {
  switch (type) {
    case 'string':
      return <Text1 size={16} color="var(--refly-text-3)" />;
    case 'option':
      return <List size={16} color="var(--refly-text-3)" />;
    case 'resource':
      return <Attachment size={16} color="var(--refly-text-3)" />;
  }
};
export const VariableIcon = (props) => {
  return (
    <Icon {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 12 10"
        fill="none"
      >
        <path
          d="M10.1758 0.25C10.4557 0.25 10.765 0.329811 11.0977 0.47168L11.4316 0.613281L11.1797 0.875L10.0596 2.03809L9.95508 2.14648L9.81055 2.10449C9.6612 2.06142 9.58676 2.0498 9.56445 2.0498C9.32012 2.04994 9.0079 2.19127 8.62207 2.55957C8.24029 2.92412 7.81633 3.48278 7.35254 4.24609V4.24707L7.14746 4.58203L7.31738 5.03613L7.31836 5.03711C7.72396 6.14004 8.08865 6.9539 8.41113 7.4873C8.57248 7.75412 8.71671 7.93958 8.8418 8.05566C8.96949 8.1741 9.05168 8.19727 9.09277 8.19727C9.41817 8.19718 9.72135 7.97943 9.95996 7.33496L10.0674 7.04492L10.3281 7.21094C10.5182 7.33178 10.7041 7.50993 10.7041 7.76074C10.704 7.98062 10.6149 8.19666 10.4756 8.40332C10.3355 8.61108 10.1332 8.8261 9.87695 9.04785C9.37113 9.4855 8.88639 9.74986 8.43555 9.75C7.95442 9.75 7.52674 9.41687 7.14746 8.89941C6.76202 8.37351 6.38328 7.60051 6.00684 6.59473L5.93555 6.40918L5.92969 6.41992L5.92871 6.42285C5.29221 7.50265 4.66015 8.32766 4.03125 8.88574C3.40202 9.44406 2.75744 9.75 2.10156 9.75C1.62681 9.74995 1.20677 9.63191 0.855469 9.38379L0.610352 9.20996L0.826172 9L1.89941 7.95605L2.0752 7.78613L2.25 7.95801C2.39121 8.09761 2.54548 8.16016 2.72266 8.16016C2.98576 8.16001 3.29864 8.02811 3.66699 7.70117C4.034 7.37542 4.43349 6.87607 4.8623 6.19043L5.34375 5.4209L5.46289 5.22559L5.21973 4.58984V4.58887C5.01018 4.05869 4.89878 3.77948 4.88184 3.74023V3.73926L4.43945 2.76367L4.43848 2.7627C4.28545 2.42155 4.14306 2.18322 4.01465 2.03418C3.88295 1.88137 3.79709 1.85742 3.75879 1.85742C3.62881 1.85756 3.49776 1.91402 3.36133 2.07422C3.21951 2.24077 3.08271 2.50979 2.96094 2.90039L2.88281 3.14941L2.63672 3.06055C2.41478 2.98002 2.19434 2.81896 2.19434 2.53223C2.19446 2.05949 2.46827 1.5672 2.92578 1.06445C3.37989 0.565535 3.84216 0.25 4.30566 0.25C4.77593 0.250051 5.19311 0.581557 5.56348 1.08984C5.94082 1.60777 6.31417 2.3689 6.6875 3.35938L6.69434 3.37695C7.33696 2.37791 7.93848 1.61267 8.49902 1.09082C9.06988 0.559408 9.63097 0.250055 10.1758 0.25Z"
          fill="#0E9F77"
          stroke="#0E9F77"
          stroke-width="0.5"
        />
      </svg>
    </Icon>
  );
};
