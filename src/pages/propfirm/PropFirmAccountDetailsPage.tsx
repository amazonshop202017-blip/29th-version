import { useNavigate, useParams } from "react-router-dom";
import RealPropFirmAccountDetails from "@/components/propfirm/RealPropFirmAccountDetails";

const PropFirmAccountDetailsPage = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const onBack = () => navigate("/prop-firm/accounts");

  if (!accountId) return null;
  return <RealPropFirmAccountDetails accountId={accountId} onBack={onBack} />;
};

export default PropFirmAccountDetailsPage;
